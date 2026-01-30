const OnlineStoreDisputes = artifacts.require("OnlineStoreDisputes");
const OrderTracking = artifacts.require("OrderTracking");

async function expectRevert(promise, message) {
  try {
    await promise;
    assert.fail("Expected revert not received");
  } catch (error) {
    assert(
      error.message.includes(message),
      `Expected "${message}", got "${error.message}"`
    );
  }
}

function getOrderIdFromTx(tx) {
  const event = tx.logs.find((log) => log.event === "OrderCreated");
  assert(event, "OrderCreated event not found");
  return event.args.orderId;
}

async function createOrder(disputes, buyer, seller, amount) {
  const tx = await disputes.createOrder(seller, amount, { from: buyer, value: amount });
  return getOrderIdFromTx(tx);
}

async function setupDeliveredOrder(disputes, tracking, buyer, seller, courier, amount) {
  const orderId = await createOrder(disputes, buyer, seller, amount);
  await tracking.createOrder(orderId, buyer, seller, { from: seller });
  await tracking.setCourier(orderId, courier, { from: seller });
  await tracking.confirmShipped(orderId, { from: courier });
  await tracking.confirmDelivery(orderId, { from: courier });
  return orderId;
}

contract("DisputeHandling (OnlineStoreDisputes)", (accounts) => {
  const [arbitrator, buyer, seller, courier, other] = accounts;
  const toWei = web3.utils.toWei;

  it("allows buyer to raise dispute and updates order state", async () => {
    const disputes = await OnlineStoreDisputes.new({ from: arbitrator });
    const amount = toWei("1", "ether");

    const orderId = await createOrder(disputes, buyer, seller, amount);

    const canBuyerRaise = await disputes.canRaiseDispute(orderId, buyer);
    const canSellerRaise = await disputes.canRaiseDispute(orderId, seller);
    assert.equal(canBuyerRaise, true);
    assert.equal(canSellerRaise, true);

    await disputes.raiseDispute(orderId, "item damaged", { from: buyer });

    const dispute = await disputes.disputes(orderId);
    assert.equal(dispute.exists, true);
    assert.equal(dispute.openedBy, buyer);
    assert.equal(dispute.reason, "item damaged");
    assert.equal(dispute.outcome.toString(), "0");

    const order = await disputes.orders(orderId);
    assert.equal(order.status.toString(), "2");
    const canRaiseAfter = await disputes.canRaiseDispute(orderId, buyer);
    assert.equal(canRaiseAfter, false);
  });

  it("rejects dispute from non-buyer/seller", async () => {
    const disputes = await OnlineStoreDisputes.new({ from: arbitrator });
    const amount = toWei("0.5", "ether");

    const orderId = await createOrder(disputes, buyer, seller, amount);

    await expectRevert(
      disputes.raiseDispute(orderId, "not my order", { from: other }),
      "Not buyer or seller"
    );
  });

  it("rejects dispute when order is not in Paid state", async () => {
    const disputes = await OnlineStoreDisputes.new({ from: arbitrator });

    await expectRevert(
      disputes.raiseDispute(1, "no order", { from: buyer }),
      "Order not in a disputable state"
    );
  });

  it("prevents duplicate disputes for the same order", async () => {
    const disputes = await OnlineStoreDisputes.new({ from: arbitrator });
    const amount = toWei("0.2", "ether");

    const orderId = await createOrder(disputes, buyer, seller, amount);
    await disputes.raiseDispute(orderId, "late shipment", { from: seller });

    await expectRevert(
      disputes.raiseDispute(orderId, "another reason", { from: buyer }),
      "Order not in a disputable state"
    );
  });

  it("only arbitrator can resolve a dispute", async () => {
    const disputes = await OnlineStoreDisputes.new({ from: arbitrator });
    const amount = toWei("1", "ether");

    const orderId = await createOrder(disputes, buyer, seller, amount);
    await disputes.raiseDispute(orderId, "missing item", { from: buyer });

    await expectRevert(
      disputes.resolveDispute(orderId, 1, { from: other }),
      "Only arbitrator can resolve"
    );
  });

  it("rejects invalid dispute outcomes", async () => {
    const disputes = await OnlineStoreDisputes.new({ from: arbitrator });
    const amount = toWei("1", "ether");

    const orderId = await createOrder(disputes, buyer, seller, amount);
    await disputes.raiseDispute(orderId, "wrong item", { from: buyer });

    await expectRevert(
      disputes.resolveDispute(orderId, 0, { from: arbitrator }),
      "Invalid outcome"
    );
  });

  it("rejects release-to-seller if tracking is not set", async () => {
    const disputes = await OnlineStoreDisputes.new({ from: arbitrator });
    const amount = toWei("0.3", "ether");

    const orderId = await createOrder(disputes, buyer, seller, amount);
    await disputes.raiseDispute(orderId, "needs delivery check", { from: buyer });

    await expectRevert(
      disputes.resolveDispute(orderId, 2, { from: arbitrator }),
      "Order tracking not set"
    );
  });

  it("releases escrow to seller after delivery when dispute is rejected", async () => {
    const tracking = await OrderTracking.new({ from: arbitrator });
    const disputes = await OnlineStoreDisputes.new({ from: arbitrator });
    await disputes.setOrderTracking(tracking.address, { from: arbitrator });

    const amount = toWei("0.75", "ether");
    const orderId = await setupDeliveredOrder(
      disputes,
      tracking,
      buyer,
      seller,
      courier,
      amount
    );

    await disputes.raiseDispute(orderId, "buyer claims not received", { from: buyer });
    await disputes.rejectRefund(orderId, { from: arbitrator });

    const order = await disputes.orders(orderId);
    assert.equal(order.status.toString(), "3");

    const dispute = await disputes.disputes(orderId);
    assert.equal(dispute.outcome.toString(), "2");

    const escrow = await disputes.escrows(orderId);
    assert.equal(escrow.status.toString(), "2");
  });

  it("approveRefund and rejectRefund are arbitrator-only", async () => {
    const tracking = await OrderTracking.new({ from: arbitrator });
    const disputes = await OnlineStoreDisputes.new({ from: arbitrator });
    await disputes.setOrderTracking(tracking.address, { from: arbitrator });

    const amount = toWei("0.4", "ether");
    const orderId = await setupDeliveredOrder(
      disputes,
      tracking,
      buyer,
      seller,
      courier,
      amount
    );

    await disputes.raiseDispute(orderId, "quality issue", { from: buyer });

    await expectRevert(
      disputes.approveRefund(orderId, { from: other }),
      "Only arbitrator"
    );
  });

  it("changes arbitrator and enforces new authority", async () => {
    const disputes = await OnlineStoreDisputes.new({ from: arbitrator });
    const amount = toWei("0.6", "ether");

    const orderId = await createOrder(disputes, buyer, seller, amount);
    await disputes.raiseDispute(orderId, "late delivery", { from: seller });

    await expectRevert(
      disputes.changeArbitrator(other, { from: buyer }),
      "Only arbitrator can change arbitrator"
    );

    await expectRevert(
      disputes.changeArbitrator("0x0000000000000000000000000000000000000000", { from: arbitrator }),
      "Invalid arbitrator"
    );

    await disputes.changeArbitrator(other, { from: arbitrator });

    await expectRevert(
      disputes.resolveDispute(orderId, 1, { from: arbitrator }),
      "Only arbitrator can resolve"
    );

    await disputes.resolveDispute(orderId, 1, { from: other });
    const dispute = await disputes.disputes(orderId);
    assert.equal(dispute.outcome.toString(), "1");
  });
});
