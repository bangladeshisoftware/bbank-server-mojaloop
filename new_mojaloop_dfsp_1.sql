-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Mar 02, 2026 at 12:35 PM
-- Server version: 8.0.43-cll-lve
-- PHP Version: 8.4.10

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `mojaloop_dfsp_1`
--

-- --------------------------------------------------------

--
-- Table structure for table `activity_logs`
--

CREATE TABLE `activity_logs` (
  `id` int NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `username` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `role` enum('ADMIN','MERCHANT') COLLATE utf8mb4_general_ci NOT NULL,
  `merchant_id` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `merchant_name` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `action` varchar(100) COLLATE utf8mb4_general_ci DEFAULT 'LOGIN',
  `ip_address` varchar(60) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `city` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `browser` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `os` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `device` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_mobile` tinyint(1) DEFAULT '0',
  `status` enum('SUCCESS','FAILED') COLLATE utf8mb4_general_ci DEFAULT 'SUCCESS',
  `note` text COLLATE utf8mb4_general_ci,
  `login_time` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `activity_logs`
--

INSERT INTO `activity_logs` (`id`, `user_id`, `username`, `email`, `role`, `merchant_id`, `merchant_name`, `action`, `ip_address`, `country`, `city`, `browser`, `os`, `device`, `is_mobile`, `status`, `note`, `login_time`) VALUES
(1, '91d243f1-1490-11f1-8555-fc3497682340', 'echodeals', 'echo-deal@gmail.com', 'MERCHANT', '19', NULL, 'LOGIN', '::1', 'Localhost', 'Local', 'Chrome 145', 'Windows 10/11', 'Desktop', 0, 'SUCCESS', NULL, '2026-03-02 01:03:04'),
(2, '91d243f1-1490-11f1-8555-fc3497682340', 'echodeals', 'echo-deal@gmail.com', 'MERCHANT', '19', NULL, 'LOGIN', '::1', 'Localhost', 'Local', 'Chrome 145', 'Windows 10/11', 'Desktop', 0, 'SUCCESS', NULL, '2026-03-02 13:57:27'),
(3, 'c112b3c7-14be-11f1-8555-fc3497682340', 'admin', 'cao.bangladeshisoftware@gmail.com', 'ADMIN', NULL, NULL, 'LOGIN', '114.130.157.77', 'Bangladesh', 'Dhaka', 'Chrome 145', 'Windows 10/11', 'Desktop', 0, 'SUCCESS', NULL, '2026-03-02 11:09:36');

-- --------------------------------------------------------

--
-- Table structure for table `als_logs`
--

CREATE TABLE `als_logs` (
  `id` int NOT NULL,
  `subject` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `initiator` varchar(10) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `callback` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `details` text COLLATE utf8mb4_general_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `merchant`
--

CREATE TABLE `merchant` (
  `id` int NOT NULL,
  `display_name` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `first_name` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `middle_name` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `last_name` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `dob` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `fsp_id` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `id_type` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `id_value` varchar(60) COLLATE utf8mb4_general_ci NOT NULL,
  `nid` varchar(30) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `acc_no` varchar(30) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `daily_limit` varchar(12) COLLATE utf8mb4_general_ci DEFAULT '0',
  `single_transaction_limit` varchar(12) COLLATE utf8mb4_general_ci DEFAULT '0',
  `status` varchar(2) COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `merchant`
--

INSERT INTO `merchant` (`id`, `display_name`, `first_name`, `middle_name`, `last_name`, `dob`, `fsp_id`, `id_type`, `id_value`, `nid`, `acc_no`, `daily_limit`, `single_transaction_limit`, `status`, `created_at`) VALUES
(19, 'Echo Deals', 'Echo', 'Deal', 's', '2026-02-16', '', 'MSISDN', '01234567890', '2344656565464565653', '13343456565654344', '120000', '1000', '1', '2026-02-15 18:05:48'),
(20, 'IT Park', 'IT', 'Park', '(ITP)', '2026-02-22', '', 'MSISDN', '01234567893', '1344656565464565614', '43434598565654342', '12000', '1000', '1', '2026-02-22 06:02:38'),
(21, 'Blood Service', 'Blood', 'Service', 'Org', '2026-03-01', '', 'MSISDN', '01233445566', '6344656555464565659', '33434593565654342', '12000', '1000', '1', '2026-03-01 04:53:58'),
(23, 'Finance IT', 'Finance', 'IT', 'FIT', '2026-03-01', '', 'MSISDN', '01222222222', '4344656574464565661', '44656767788988561', '12000', '1000', '1', '2026-03-01 05:41:37');

-- --------------------------------------------------------

--
-- Table structure for table `merchant_balance`
--

CREATE TABLE `merchant_balance` (
  `id` int NOT NULL,
  `merchant_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `transaction_id` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `transfer_id` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `type` enum('CREDIT','DEBIT') COLLATE utf8mb4_general_ci NOT NULL,
  `amount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `fee` decimal(18,2) NOT NULL DEFAULT '0.00',
  `balance_before` decimal(18,2) NOT NULL DEFAULT '0.00',
  `balance_after` decimal(18,2) NOT NULL DEFAULT '0.00',
  `currency` varchar(10) COLLATE utf8mb4_general_ci DEFAULT 'BDT',
  `note` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `merchant_balance`
--

INSERT INTO `merchant_balance` (`id`, `merchant_id`, `user_id`, `transaction_id`, `transfer_id`, `type`, `amount`, `fee`, `balance_before`, `balance_after`, `currency`, `note`, `created_at`, `updated_at`) VALUES
(1, '19', '91d243f1-1490-11f1-8555-fc3497682340', NULL, NULL, 'CREDIT', 2000.00, 0.00, 0.00, 2000.00, 'BDT', 'Account Opening Deposit.', '2026-03-02 13:54:16', '2026-03-02 14:31:23'),
(2, '20', NULL, NULL, NULL, 'CREDIT', 2000.00, 0.00, 0.00, 2000.00, 'BDT', 'Account Opening Deposit.', '2026-03-02 13:54:56', '2026-03-02 13:54:56'),
(3, '21', NULL, NULL, NULL, 'CREDIT', 2000.00, 0.00, 0.00, 2000.00, 'BDT', 'Account Opening Deposit.', '2026-03-02 13:55:00', '2026-03-02 13:55:00'),
(4, '23', NULL, NULL, NULL, 'CREDIT', 2000.00, 0.00, 0.00, 2000.00, 'BDT', 'Account Opening Deposit.', '2026-03-02 13:55:08', '2026-03-02 13:55:08');

-- --------------------------------------------------------

--
-- Table structure for table `merchant_wallet`
--

CREATE TABLE `merchant_wallet` (
  `id` int NOT NULL,
  `merchant_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `balance` decimal(18,2) NOT NULL DEFAULT '0.00',
  `total_credit` decimal(18,2) NOT NULL DEFAULT '0.00',
  `total_debit` decimal(18,2) NOT NULL DEFAULT '0.00',
  `total_fee` decimal(18,2) NOT NULL DEFAULT '0.00',
  `currency` varchar(10) COLLATE utf8mb4_general_ci DEFAULT 'BDT',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `merchant_wallet`
--

INSERT INTO `merchant_wallet` (`id`, `merchant_id`, `user_id`, `balance`, `total_credit`, `total_debit`, `total_fee`, `currency`, `created_at`, `updated_at`) VALUES
(1, '19', '91d243f1-1490-11f1-8555-fc3497682340', 2000.00, 2000.00, 0.00, 0.00, 'BDT', '2026-03-02 13:54:16', '2026-03-02 14:32:13'),
(2, '20', NULL, 2000.00, 2000.00, 0.00, 0.00, 'BDT', '2026-03-02 13:54:56', '2026-03-02 13:54:56'),
(3, '21', NULL, 2000.00, 2000.00, 0.00, 0.00, 'BDT', '2026-03-02 13:55:00', '2026-03-02 13:55:00'),
(4, '23', NULL, 2000.00, 2000.00, 0.00, 0.00, 'BDT', '2026-03-02 13:55:08', '2026-03-02 13:55:08');

-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `id` int NOT NULL,
  `quote_fee` varchar(12) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `quote_expire` varchar(12) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `settings`
--

INSERT INTO `settings` (`id`, `quote_fee`, `quote_expire`, `created_at`) VALUES
(1, '0', '5', '2025-11-02 14:52:15');

-- --------------------------------------------------------

--
-- Table structure for table `transactions`
--

CREATE TABLE `transactions` (
  `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `transfer_id` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `quote_id` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `transaction_id` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `type` enum('P2P','INSTANT','BULK','NPSB','RTGS','BEFTN') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'P2P',
  `direction` enum('OUTGOING','INCOMING') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'OUTGOING',
  `payer_fsp` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `payee_fsp` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `payer_id_type` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `payer_id_value` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `payer_name` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `payee_id_type` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `payee_id_value` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `payee_name` varchar(200) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `merchant_id` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `initiated_by` varchar(36) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `amount` decimal(18,4) NOT NULL,
  `currency` varchar(10) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'BDT',
  `fee` decimal(18,4) DEFAULT '0.0000',
  `receive_amount` decimal(18,4) DEFAULT NULL,
  `ilp_packet` mediumtext COLLATE utf8mb4_general_ci,
  `condition_hash` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `fulfilment` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `expiration` datetime DEFAULT NULL,
  `status` enum('PENDING','QUOTE_REQUESTED','QUOTE_RECEIVED','TRANSFER_SENT','COMMITTED','FAILED','EXPIRED','ABORTED') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'PENDING',
  `error_code` varchar(10) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `error_description` text COLLATE utf8mb4_general_ci,
  `quote_at` datetime DEFAULT NULL,
  `transfer_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `transactions`
--

INSERT INTO `transactions` (`id`, `transfer_id`, `quote_id`, `transaction_id`, `type`, `direction`, `payer_fsp`, `payee_fsp`, `payer_id_type`, `payer_id_value`, `payer_name`, `payee_id_type`, `payee_id_value`, `payee_name`, `merchant_id`, `initiated_by`, `amount`, `currency`, `fee`, `receive_amount`, `ilp_packet`, `condition_hash`, `fulfilment`, `expiration`, `status`, `error_code`, `error_description`, `quote_at`, `transfer_at`, `completed_at`, `created_at`, `updated_at`) VALUES
('8a94d647-1471-11f1-8555-fc3497682340', 'a25216d8-b414-4112-9b4f-906d0803f998', '835ef26f-825c-485a-8993-40e91a808f8e', 'c489ab17-9ffb-4119-a144-d1f82a86952f', 'P2P', 'OUTGOING', 'ABank', 'BBank', 'MSISDN', '01234567890', 'Echo s', 'MSISDN', '01234567891', NULL, '19', NULL, 5.0000, 'BDT', 0.0000, 5.0000, 'eyJhbW91bnQiOiI1IiwiY3VycmVuY3kiOiJCRFQiLCJwYXllZSI6eyJpZCI6IjAxMjM0NTY3ODkxIn0sInBheWVyIjp7ImlkIjoiMDEyMzQ1Njc4OTAifSwiZXhwaXJhdGlvbiI6IjIwMjYtMDItMjhUMDc6NDg6NTEuNzE5WiJ9', 'XYLQ0IQ9NVQg3lYUpt5_qzVYa5GQ6FSdm3wO-gDrN2s', NULL, '2026-02-28 08:48:52', 'COMMITTED', NULL, NULL, '2026-02-28 07:48:51', '2026-02-28 07:49:00', '2026-02-28 07:49:01', '2026-02-28 07:48:51', '2026-02-28 07:49:01');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `username` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(150) COLLATE utf8mb4_general_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `full_name` varchar(150) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone` varchar(30) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `merchant_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `role` enum('ADMIN','MERCHANT') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'MERCHANT',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `otp` varchar(10) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `otp_expires_at` datetime DEFAULT NULL,
  `last_login` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `email`, `password`, `full_name`, `phone`, `merchant_id`, `role`, `is_active`, `otp`, `otp_expires_at`, `last_login`, `created_at`, `updated_at`) VALUES
('0bdb88d9-8b65-4675-aa8f-d3bc02a0b349', 'coo.bangladeshisoftware', 'coo.bangladeshisoftware@gmail.com', '$2b$10$BgPz2uwE5C.8dzONMofVJugxigqkGG4qrf9ihW8Ped5BASdOSPm7O', 'Finance IT', '01222222222', '23', 'MERCHANT', 1, NULL, NULL, NULL, '2026-03-01 05:41:37', '2026-03-01 05:41:37'),
('7f3c1a10-14be-11f1-8555-fc3497682340', 'contact', 'contact@blood-service.org', '$2b$10$CNtRHJg0B7VLpO8xqCLr.OE1jg3AwupCckh9RXa.mp1OhJxwKnm1S', 'Blood Service', '01233445566', '21', 'MERCHANT', 1, NULL, NULL, NULL, '2026-03-01 04:53:58', '2026-03-01 04:53:58'),
('91d243f1-1490-11f1-8555-fc3497682340', 'echodeals', 'echo-deal@gmail.com', '$2a$10$DLASP9zw8e.xn95qrgRtTOyY/8.U0b6yZH.01riSFLX.enmwjjvFa', 'Echo Deals', '01234567890', '19', 'MERCHANT', 1, NULL, NULL, '2026-03-02 13:57:27', '2026-02-28 11:30:57', '2026-03-02 13:57:27'),
('91d24a01-1490-11f1-8555-fc3497682340', 'd_marchant', 'd_marchant@gmail.com', '$2a$10$DLASP9zw8e.xn95qrgRtTOyY/8.U0b6yZH.01riSFLX.enmwjjvFa', 'D Merchant', '01234567893', '20', 'MERCHANT', 1, NULL, NULL, NULL, '2026-02-28 11:30:57', '2026-02-28 13:55:24'),
('c112b3c7-14be-11f1-8555-fc3497682340', 'admin', 'cao.bangladeshisoftware@gmail.com', '$2b$12$cwPB0KFgyKC7uglHiOH0OuXPpx0vxApPmdJmfNEmmssNtNF65q4SC', 'Admin', '01345678900', '', 'ADMIN', 1, NULL, NULL, '2026-03-02 11:09:36', '2026-02-28 17:01:34', '2026-03-02 11:09:36');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_merchant` (`merchant_id`),
  ADD KEY `idx_login_time` (`login_time`);

--
-- Indexes for table `als_logs`
--
ALTER TABLE `als_logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `merchant`
--
ALTER TABLE `merchant`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `merchant_balance`
--
ALTER TABLE `merchant_balance`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_merchant_id` (`merchant_id`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_transfer_id` (`transfer_id`);

--
-- Indexes for table `merchant_wallet`
--
ALTER TABLE `merchant_wallet`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `merchant_id` (`merchant_id`),
  ADD UNIQUE KEY `uq_merchant` (`merchant_id`);

--
-- Indexes for table `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `transactions`
--
ALTER TABLE `transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_transfer_id` (`transfer_id`),
  ADD KEY `idx_quote_id` (`quote_id`),
  ADD KEY `idx_direction` (`direction`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_merchant` (`merchant_id`),
  ADD KEY `idx_created` (`created_at`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_username` (`username`),
  ADD UNIQUE KEY `uq_email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `activity_logs`
--
ALTER TABLE `activity_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `als_logs`
--
ALTER TABLE `als_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `merchant`
--
ALTER TABLE `merchant`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `merchant_balance`
--
ALTER TABLE `merchant_balance`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `merchant_wallet`
--
ALTER TABLE `merchant_wallet`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `settings`
--
ALTER TABLE `settings`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
