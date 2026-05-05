-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: May 05, 2026 at 02:21 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `dfsp_a`
--

-- --------------------------------------------------------

--
-- Table structure for table `activity_logs`
--

CREATE TABLE `activity_logs` (
  `id` int(11) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `username` varchar(100) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `role` enum('ADMIN','MERCHANT') NOT NULL,
  `merchant_id` varchar(36) DEFAULT NULL,
  `merchant_name` varchar(100) DEFAULT NULL,
  `action` varchar(100) DEFAULT 'LOGIN',
  `ip_address` varchar(60) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `browser` varchar(200) DEFAULT NULL,
  `os` varchar(100) DEFAULT NULL,
  `device` varchar(50) DEFAULT NULL,
  `is_mobile` tinyint(1) DEFAULT 0,
  `status` enum('SUCCESS','FAILED') DEFAULT 'SUCCESS',
  `note` text DEFAULT NULL,
  `login_time` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `als_logs`
--

CREATE TABLE `als_logs` (
  `id` int(11) NOT NULL,
  `subject` varchar(100) DEFAULT NULL,
  `initiator` varchar(10) DEFAULT NULL,
  `callback` varchar(255) DEFAULT NULL,
  `details` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `merchant`
--

CREATE TABLE `merchant` (
  `id` int(11) NOT NULL,
  `display_name` varchar(30) NOT NULL,
  `first_name` varchar(30) NOT NULL,
  `middle_name` varchar(30) NOT NULL,
  `last_name` varchar(30) NOT NULL,
  `dob` varchar(30) NOT NULL,
  `fsp_id` varchar(50) NOT NULL,
  `id_type` varchar(50) NOT NULL,
  `id_value` varchar(60) NOT NULL,
  `nid` varchar(30) DEFAULT NULL,
  `acc_no` varchar(30) DEFAULT NULL,
  `daily_limit` varchar(12) DEFAULT '0',
  `single_transaction_limit` varchar(12) DEFAULT '0',
  `status` varchar(2) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `merchant_balance`
--

CREATE TABLE `merchant_balance` (
  `id` int(11) NOT NULL,
  `merchant_id` varchar(36) NOT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `transaction_id` varchar(100) DEFAULT NULL,
  `transfer_id` varchar(100) DEFAULT NULL,
  `type` enum('CREDIT','DEBIT') NOT NULL,
  `amount` decimal(18,2) NOT NULL DEFAULT 0.00,
  `fee` decimal(18,2) NOT NULL DEFAULT 0.00,
  `balance_before` decimal(18,2) NOT NULL DEFAULT 0.00,
  `balance_after` decimal(18,2) NOT NULL DEFAULT 0.00,
  `currency` varchar(10) DEFAULT 'BDT',
  `note` varchar(200) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `merchant_wallet`
--

CREATE TABLE `merchant_wallet` (
  `id` int(11) NOT NULL,
  `merchant_id` varchar(36) NOT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `balance` decimal(18,2) NOT NULL DEFAULT 0.00,
  `total_credit` decimal(18,2) NOT NULL DEFAULT 0.00,
  `total_debit` decimal(18,2) NOT NULL DEFAULT 0.00,
  `total_fee` decimal(18,2) NOT NULL DEFAULT 0.00,
  `currency` varchar(10) DEFAULT 'BDT',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `id` int(11) NOT NULL,
  `quote_fee` varchar(12) DEFAULT NULL,
  `quote_expire` varchar(12) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
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
  `id` varchar(36) NOT NULL,
  `transfer_id` varchar(36) DEFAULT NULL,
  `quote_id` varchar(36) DEFAULT NULL,
  `transaction_id` varchar(36) DEFAULT NULL,
  `type` enum('P2P','INSTANT','BULK','NPSB','RTGS','BEFTN') NOT NULL DEFAULT 'P2P',
  `direction` enum('OUTGOING','INCOMING') NOT NULL DEFAULT 'OUTGOING',
  `payer_fsp` varchar(100) DEFAULT NULL,
  `payee_fsp` varchar(100) DEFAULT NULL,
  `payer_id_type` varchar(50) DEFAULT NULL,
  `payer_id_value` varchar(100) DEFAULT NULL,
  `payer_name` varchar(200) DEFAULT NULL,
  `payee_id_type` varchar(50) DEFAULT NULL,
  `payee_id_value` varchar(100) DEFAULT NULL,
  `payee_name` varchar(200) DEFAULT NULL,
  `merchant_id` varchar(36) DEFAULT NULL,
  `initiated_by` varchar(36) DEFAULT NULL,
  `amount` decimal(18,4) NOT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'BDT',
  `fee` decimal(18,4) DEFAULT 0.0000,
  `receive_amount` decimal(18,4) DEFAULT NULL,
  `ilp_packet` mediumtext DEFAULT NULL,
  `condition_hash` varchar(255) DEFAULT NULL,
  `fulfilment` varchar(255) DEFAULT NULL,
  `expiration` datetime DEFAULT NULL,
  `status` enum('PENDING','QUOTE_REQUESTED','QUOTE_RECEIVED','TRANSFER_SENT','COMMITTED','FAILED','EXPIRED','ABORTED') NOT NULL DEFAULT 'PENDING',
  `error_code` varchar(10) DEFAULT NULL,
  `error_description` text DEFAULT NULL,
  `quote_at` datetime DEFAULT NULL,
  `transfer_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` varchar(36) NOT NULL,
  `username` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `full_name` varchar(150) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `merchant_id` varchar(36) NOT NULL,
  `role` enum('ADMIN','MERCHANT') NOT NULL DEFAULT 'MERCHANT',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `otp` varchar(10) DEFAULT NULL,
  `otp_expires_at` datetime DEFAULT NULL,
  `last_login` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `email`, `password`, `full_name`, `phone`, `merchant_id`, `role`, `is_active`, `otp`, `otp_expires_at`, `last_login`, `created_at`, `updated_at`) VALUES
('c112b3c7-14be-11f1-8555-fc3497682340', 'admin', 'your-email@gmail.com', '$2b$12$cwPB0KFgyKC7uglHiOH0OuXPpx0vxApPmdJmfNEmmssNtNF65q4SC', 'Admin', '01345678900', '', 'ADMIN', 1, NULL, NULL, '2026-03-02 18:13:04', '2026-02-28 17:01:34', '2026-05-05 18:21:20');

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `als_logs`
--
ALTER TABLE `als_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `merchant`
--
ALTER TABLE `merchant`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `merchant_balance`
--
ALTER TABLE `merchant_balance`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `merchant_wallet`
--
ALTER TABLE `merchant_wallet`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `settings`
--
ALTER TABLE `settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
