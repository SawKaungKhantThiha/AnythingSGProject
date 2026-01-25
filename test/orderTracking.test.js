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

contract("OrderTracking", (accounts) => {
  const [deployer, buyer, seller, courier, other] = accounts;

  it("creates an order with Created status", async () => {
    const contract = await OrderTracking.new({ from: deployer });
    await contract.createOrder(1, buyer, seller, { from: deployer });

    const order = await contract.getOrder(1);
    assert.equal(order.buyer, buyer);
    assert.equal(order.seller, seller);
    assert.equal(order.courier, "0x0000000000000000000000000000000000000000");
    assert.equal(order.status.toString(), "1");
  });

  it("rejects duplicate order IDs", async () => {
    const contract = await OrderTracking.new({ from: deployer });
    await contract.createOrder(10, buyer, seller, { from: deployer });

    await expectRevert(
      contract.createOrder(10, buyer, seller, { from: deployer }),
      "Order already exists"
    );
  });

  it("assigns a courier for delivery tracking", async () => {
    const contract = await OrderTracking.new({ from: deployer });
    await contract.createOrder(2, buyer, seller, { from: deployer });

    await contract.setCourier(2, courier, { from: seller });
    const order = await contract.getOrder(2);
    assert.equal(order.courier, courier);
  });

  it("allows only seller or courier to confirm shipped", async () => {
    const contract = await OrderTracking.new({ from: deployer });
    await contract.createOrder(3, buyer, seller, { from: deployer });
    await contract.setCourier(3, courier, { from: seller });

    await expectRevert(
      contract.confirmShipped(3, { from: other }),
      "Not seller/courier"
    );

    await contract.confirmShipped(3, { from: seller });
    const status = await contract.getOrderStatus(3);
    assert.equal(status.toString(), "2");
  });

  it("requires shipped status before delivery confirmation", async () => {
    const contract = await OrderTracking.new({ from: deployer });
    await contract.createOrder(4, buyer, seller, { from: deployer });
    await contract.setCourier(4, courier, { from: seller });

    await expectRevert(
      contract.confirmDelivery(4, { from: buyer }),
      "Order not in Shipped state"
    );

    await contract.confirmShipped(4, { from: courier });
    await contract.confirmDelivery(4, { from: buyer });
    const status = await contract.getOrderStatus(4);
    assert.equal(status.toString(), "3");
  });
});
