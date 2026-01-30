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

function toBN(value) {
  return web3.utils.toBN(value);
}

async function setupDisputesWithTracking(owner) {
  const tracking = await OrderTracking.new({ from: owner });
  const disputes = await OnlineStoreDisputes.new({ from: owner });
  await disputes.setOrderTracking(tracking.address, { from: owner });
  return { disputes, tracking };
}

async function markDelivered(tracking, orderId, buyer, seller) {
  await tracking.createOrder(orderId, buyer, seller, { from: seller });
  await tracking.setCourier(orderId, seller, { from: seller });
  await tracking.confirmShipped(orderId, { from: seller });
  await tracking.confirmDelivery(orderId, { from: seller });
}

function getOrderIdFromTx(tx) {
  const event = tx.logs.find((log) => log.event === "OrderCreated");
  assert(event, "OrderCreated event not found");
  return event.args.orderId;
}

contract("PlatformFee", (accounts) => {
  const [owner, buyer, seller, other] = accounts;

  it("platform fee is correctly deducted on successful escrow release", async () => {
    const { disputes, tracking } = await setupDisputesWithTracking(owner);

    const amount = web3.utils.toWei("1", "ether");
    const tx = await disputes.createOrder(seller, amount, { from: buyer, value: amount });
    const orderId = getOrderIdFromTx(tx);
    await markDelivered(tracking, orderId, buyer, seller);

    const feeBP = await disputes.platformFeeBP();
    const fee = toBN(amount).mul(toBN(feeBP)).div(toBN(10000));
    const payout = toBN(amount).sub(fee);

    const sellerBalanceBefore = toBN(await web3.eth.getBalance(seller));
    await disputes.completeOrder(orderId, { from: buyer });
    const sellerBalanceAfter = toBN(await web3.eth.getBalance(seller));

    const platformBalance = await disputes.platformBalance();
    assert.equal(platformBalance.toString(), fee.toString());
    assert.equal(sellerBalanceAfter.sub(sellerBalanceBefore).toString(), payout.toString());

    const escrow = await disputes.escrows(orderId);
    assert.equal(escrow.status.toString(), "2");
  });

  it("no platform fee is charged when an escrow is refunded", async () => {
    const disputes = await OnlineStoreDisputes.new({ from: owner });

    const amount = web3.utils.toWei("0.5", "ether");
    const tx = await disputes.createOrder(seller, amount, { from: buyer, value: amount });
    const orderId = getOrderIdFromTx(tx);

    await disputes.raiseDispute(orderId, "item not delivered", { from: buyer });
    await disputes.resolveDispute(orderId, 1, { from: owner });

    const platformBalance = await disputes.platformBalance();
    assert.equal(platformBalance.toString(), "0");

    const escrow = await disputes.escrows(orderId);
    assert.equal(escrow.status.toString(), "3");
  });

  it("only platform owner can set or update the platform fee", async () => {
    const disputes = await OnlineStoreDisputes.new({ from: owner });

    await expectRevert(
      disputes.setPlatformFee(250, { from: other }),
      "Not platform owner"
    );
  });

  it("platform fee cannot exceed the maximum allowed cap", async () => {
    const disputes = await OnlineStoreDisputes.new({ from: owner });

    await expectRevert(
      disputes.setPlatformFee(501, { from: owner }),
      "Fee too high"
    );
  });

  it("only platform owner can withdraw accumulated platform fees", async () => {
    const { disputes, tracking } = await setupDisputesWithTracking(owner);

    const amount = web3.utils.toWei("1", "ether");
    const tx = await disputes.createOrder(seller, amount, { from: buyer, value: amount });
    const orderId = getOrderIdFromTx(tx);
    await markDelivered(tracking, orderId, buyer, seller);
    await disputes.completeOrder(orderId, { from: buyer });

    await expectRevert(
      disputes.withdrawPlatformFees({ from: other }),
      "Not platform owner"
    );
  });

  it("platform fee withdrawal does not affect active escrow funds", async () => {
    const { disputes, tracking } = await setupDisputesWithTracking(owner);

    const activeAmount = web3.utils.toWei("0.25", "ether");
    const activeTx = await disputes.createOrder(seller, activeAmount, { from: buyer, value: activeAmount });
    const activeOrderId = getOrderIdFromTx(activeTx);

    const releaseAmount = web3.utils.toWei("1", "ether");
    const releaseTx = await disputes.createOrder(seller, releaseAmount, { from: buyer, value: releaseAmount });
    const releaseOrderId = getOrderIdFromTx(releaseTx);
    await markDelivered(tracking, releaseOrderId, buyer, seller);
    await disputes.completeOrder(releaseOrderId, { from: buyer });

    const platformBalance = await disputes.platformBalance();
    assert(platformBalance.gt(toBN(0)), "Platform balance should be positive");

    const contractBalanceBefore = toBN(await web3.eth.getBalance(disputes.address));
    await disputes.withdrawPlatformFees({ from: owner });
    const contractBalanceAfter = toBN(await web3.eth.getBalance(disputes.address));

    assert.equal(contractBalanceAfter.toString(), toBN(activeAmount).toString());
    assert.equal(contractBalanceBefore.sub(contractBalanceAfter).toString(), platformBalance.toString());

    const escrow = await disputes.escrows(activeOrderId);
    assert.equal(escrow.status.toString(), "1");
    assert.equal(escrow.amount.toString(), toBN(activeAmount).toString());
  });
});
