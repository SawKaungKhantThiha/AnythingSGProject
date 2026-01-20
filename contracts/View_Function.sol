// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/*
I declare that this code was written by me.
I will not copy or allow others to copy my code.
I understand that copying code is considered as plagiarism.

Student Name: Arut
Student ID: 24027003
Class: C372-003
Date created: 16/01/2026
*/

interface IOnlineStoreDisputes {
    enum OrderStatus {
        None,
        Paid,
        Disputed,
        Resolved
    }

    function orders(uint256 orderId)
        external
        view
        returns (
            address buyer,
            address seller,
            uint256 amount,
            OrderStatus status,
            bool payoutDone
        );
}

contract EscrowView {

    IOnlineStoreDisputes public disputes;

    constructor(address disputesAddress) {
        require(disputesAddress != address(0), "Invalid disputes address");
        disputes = IOnlineStoreDisputes(disputesAddress);
    }

    // ---------------------------------
    // VIEW (READ-ONLY) FUNCTIONS
    // ---------------------------------

    // Returns current order status
    function getOrderStatus(uint256 orderId)
        external
        view
        returns (IOnlineStoreDisputes.OrderStatus)
    {
        (, , , IOnlineStoreDisputes.OrderStatus status, ) = disputes.orders(orderId);
        return status;
    }

    // Returns escrowed USDC amount for the order
    function getEscrowAmount(uint256 orderId)
        external
        view
        returns (uint256)
    {
        (, , uint256 amount, , ) = disputes.orders(orderId);
        return amount;
    }
}
