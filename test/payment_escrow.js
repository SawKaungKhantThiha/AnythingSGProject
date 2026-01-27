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

contract("Payment Escrow (OnlineStoreDisputes)", (accounts) => {
  const [deployer, buyer, seller, courier] = accounts;
  const toBN = web3.utils.toBN;
  const toWei = web3.utils.toWei;

  it("creates escrow on order creation with Locked status", async () => {
    const contract = await OnlineStoreDisputes.new({ from: deployer });
    const amount = toWei("1", "ether");

    const orderId = await contract.createOrder.call(seller, amount, {
      from: buyer,
      value: amount,
    });
    await contract.createOrder(seller, amount, { from: buyer, value: amount });

    const escrow = await contract.getEscrow(orderId);
    assert.equal(escrow[0], buyer);
    assert.equal(escrow[1], seller);
    assert.equal(escrow[2].toString(), amount);
    assert.equal(escrow[3].toString(), "1");

    const order = await contract.orders(orderId);
    assert.equal(order.status.toString(), "1");
  });

  it("rejects order creation when msg.value does not match amount", async () => {
    const contract = await OnlineStoreDisputes.new({ from: deployer });
    const amount = toWei("1", "ether");
    const wrongValue = toBN(amount).subn(1).toString();

    await expectRevert(
      contract.createOrder(seller, amount, { from: buyer, value: wrongValue }),
      "Incorrect ETH amount"
    );
  });

  it("refunds buyer on dispute resolution without platform fee", async () => {
    const contract = await OnlineStoreDisputes.new({ from: deployer });
    const amount = toWei("1", "ether");

    const orderId = await contract.createOrder.call(seller, amount, {
      from: buyer,
      value: amount,
    });
    await contract.createOrder(seller, amount, { from: buyer, value: amount });

    await contract.raiseDispute(orderId, "late delivery", { from: buyer });
    await contract.resolveDispute(orderId, 1, { from: deployer });

    const escrow = await contract.getEscrow(orderId);
    assert.equal(escrow[3].toString(), "3");

    const platformBalance = await contract.platformBalance();
    assert.equal(platformBalance.toString(), "0");
  });

  it("requires delivery before releasing escrow to seller in dispute", async () => {
    const orderTracking = await OrderTracking.new({ from: deployer });
    const contract = await OnlineStoreDisputes.new({ from: deployer });
    await contract.setOrderTracking(orderTracking.address, { from: deployer });

    const dummyAmount = toWei("0.1", "ether");
    await contract.createOrder(seller, dummyAmount, {
      from: buyer,
      value: dummyAmount,
    });

    await orderTracking.createOrder(1, buyer, seller, { from: deployer });

    const amount = toWei("1", "ether");
    const orderId = await contract.createOrder.call(seller, amount, {
      from: buyer,
      value: amount,
    });
    await contract.createOrder(seller, amount, { from: buyer, value: amount });

    await contract.raiseDispute(orderId, "item not delivered", { from: seller });
    await expectRevert(
      contract.resolveDispute(orderId, 2, { from: deployer }),
      "Order not delivered"
    );
  });

  it("completes order, releases escrow, and collects platform fee", async () => {
    const orderTracking = await OrderTracking.new({ from: deployer });
    const contract = await OnlineStoreDisputes.new({ from: deployer });
    await contract.setOrderTracking(orderTracking.address, { from: deployer });

    const dummyAmount = toWei("0.1", "ether");
    await contract.createOrder(seller, dummyAmount, {
      from: buyer,
      value: dummyAmount,
    });

    await orderTracking.createOrder(1, buyer, seller, { from: deployer });
    await orderTracking.setCourier(1, courier, { from: seller });
    await orderTracking.confirmShipped(1, { from: courier });
    await orderTracking.confirmDelivery(1, { from: courier });

    const amount = toWei("1", "ether");
    const orderId = await contract.createOrder.call(seller, amount, {
      from: buyer,
      value: amount,
    });
    await contract.createOrder(seller, amount, { from: buyer, value: amount });

    await contract.completeOrder(orderId, { from: buyer });

    const escrow = await contract.getEscrow(orderId);
    assert.equal(escrow[3].toString(), "2");

    const feeBP = await contract.platformFeeBP();
    const expectedFee = toBN(amount).mul(toBN(feeBP)).div(toBN(10000));
    const platformBalance = await contract.platformBalance();
    assert.equal(platformBalance.toString(), expectedFee.toString());
  });
});
