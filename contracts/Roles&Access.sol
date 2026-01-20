// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract EscrowRoles {
    /*//////////////////////////////////////////////////////////////
                                ROLES
    //////////////////////////////////////////////////////////////*/

    address public owner;
    address public arbitrator;

    struct OrderRoles {
        address buyer;
        address seller;
        address courier;
    }

    mapping(uint256 => OrderRoles) internal orderRoles;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event CourierAssigned(uint256 indexed orderId, address courier);
    event ArbitratorAssigned(address arbitrator);

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        require(msg.sender == owner, "Not platform owner");
        _;
    }

    modifier onlyBuyer(uint256 orderId) {
        require(msg.sender == orderRoles[orderId].buyer, "Not buyer");
        _;
    }

    modifier onlySeller(uint256 orderId) {
        require(msg.sender == orderRoles[orderId].seller, "Not seller");
        _;
    }

    modifier onlyCourier(uint256 orderId) {
        require(msg.sender == orderRoles[orderId].courier, "Not courier");
        _;
    }

    modifier onlyArbitrator() {
        require(msg.sender == arbitrator, "Not arbitrator");
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor() {
        owner = msg.sender;
    }

    /*//////////////////////////////////////////////////////////////
                          ROLE ASSIGNMENT
    //////////////////////////////////////////////////////////////*/

    function _setOrderParties(
        uint256 orderId,
        address buyer,
        address seller
    ) internal {
        orderRoles[orderId].buyer = buyer;
        orderRoles[orderId].seller = seller;
    }

    function setCourier(
        uint256 orderId,
        address courier
    ) external onlySeller(orderId) {
        orderRoles[orderId].courier = courier;
        emit CourierAssigned(orderId, courier);
    }

    function assignArbitrator(
        address _arbitrator
    ) external onlyOwner {
        arbitrator = _arbitrator;
        emit ArbitratorAssigned(_arbitrator);
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW HELPERS
    //////////////////////////////////////////////////////////////*/

    function getOrderRoles(
        uint256 orderId
    )
        external
        view
        returns (
            address buyer,
            address seller,
            address courier
        )
    {
        OrderRoles memory r = orderRoles[orderId];
        return (r.buyer, r.seller, r.courier);
    }
}
