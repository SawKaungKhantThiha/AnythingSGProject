const OrderTracking = artifacts.require("OrderTracking");
const OnlineStoreDisputes = artifacts.require("OnlineStoreDisputes");

module.exports = async function (deployer) {
  await deployer.deploy(OrderTracking);

  await deployer.deploy(OnlineStoreDisputes);
  const orderTracking = await OrderTracking.deployed();
  const disputes = await OnlineStoreDisputes.deployed();
  await disputes.setOrderTracking(orderTracking.address);
};

