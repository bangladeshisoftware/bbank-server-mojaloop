-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Mar 29, 2026 at 12:15 PM
-- Server version: 11.4.10-MariaDB
-- PHP Version: 8.4.18

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `mojaloop_dfsp_2`
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

--
-- Dumping data for table `activity_logs`
--

INSERT INTO `activity_logs` (`id`, `user_id`, `username`, `email`, `role`, `merchant_id`, `merchant_name`, `action`, `ip_address`, `country`, `city`, `browser`, `os`, `device`, `is_mobile`, `status`, `note`, `login_time`) VALUES
(3, '5692d84f-1620-11f1-8555-fc3497682340', 'admin', 'cao.bangladeshisoftware@gmail.com', 'ADMIN', NULL, NULL, 'LOGIN', '114.130.157.77', 'Bangladesh', 'Dhaka', 'Chrome 145', 'Windows 10/11', 'Desktop', 0, 'SUCCESS', NULL, '2026-03-02 11:39:30'),
(4, '5692d84f-1620-11f1-8555-fc3497682340', 'admin', 'cao.bangladeshisoftware@gmail.com', 'ADMIN', NULL, NULL, 'LOGIN', '114.130.157.77', 'Bangladesh', 'Dhaka', 'Chrome 145', 'Windows 10/11', 'Desktop', 0, 'SUCCESS', NULL, '2026-03-02 12:03:34'),
(5, '5692d84f-1620-11f1-8555-fc3497682340', 'admin', 'cao.bangladeshisoftware@gmail.com', 'ADMIN', NULL, NULL, 'LOGIN', '114.130.157.77', 'Bangladesh', 'Dhaka', 'Chrome 145', 'Windows 10/11', 'Desktop', 0, 'SUCCESS', NULL, '2026-03-02 12:45:16'),
(6, '5692d84f-1620-11f1-8555-fc3497682340', 'admin', 'coo.bangladeshisoftware@gmail.com', 'ADMIN', NULL, NULL, 'LOGIN', '114.130.157.77', 'Bangladesh', 'Dhaka', 'Chrome 145', 'Windows 10/11', 'Desktop', 0, 'SUCCESS', NULL, '2026-03-02 12:56:12'),
(7, '5692d84f-1620-11f1-8555-fc3497682340', 'admin', 'coo.bangladeshisoftware@gmail.com', 'ADMIN', NULL, NULL, 'LOGIN', '114.130.157.77', 'Bangladesh', 'Dhaka', 'Chrome 145', 'Windows 10/11', 'Desktop', 0, 'SUCCESS', NULL, '2026-03-02 12:58:45'),
(8, '5692d84f-1620-11f1-8555-fc3497682340', 'admin', 'coo.bangladeshisoftware@gmail.com', 'ADMIN', NULL, NULL, 'LOGIN', '114.130.157.77', 'Bangladesh', 'Dhaka', 'Chrome 145', 'Windows 10/11', 'Desktop', 0, 'SUCCESS', NULL, '2026-03-02 13:15:53'),
(9, '5692d84f-1620-11f1-8555-fc3497682340', 'cao', 'cao.bangladeshisoftware@gmail.com', 'ADMIN', NULL, NULL, 'LOGIN', '114.130.157.77', 'Bangladesh', 'Dhaka', 'Chrome 145', 'Windows 10/11', 'Desktop', 0, 'SUCCESS', NULL, '2026-03-02 17:16:38'),
(10, '91d243f1-1490-11f1-8555-fc3497682340', 'it_satellite', 'it_satellite@gmail.com', 'MERCHANT', '13', NULL, 'LOGIN', '114.130.157.77', 'Bangladesh', 'Dhaka', 'Chrome 145', 'Windows 10/11', 'Desktop', 0, 'SUCCESS', NULL, '2026-03-05 06:20:05'),
(11, '3692t84f-1620-11f1-9555-fc3497682331', 'admin', 'ceo.bangladeshisoftware@gmail.com', 'ADMIN', NULL, NULL, 'LOGIN', '103.59.179.19', 'Bangladesh', 'Sylhet', 'Chrome 145', 'Windows 10/11', 'Desktop', 0, 'SUCCESS', NULL, '2026-03-06 17:31:18'),
(12, '5692d84f-1620-11f1-8555-fc3497682340', 'cao', 'cao.bangladeshisoftware@gmail.com', 'ADMIN', NULL, NULL, 'LOGIN', '114.130.157.77', 'Bangladesh', 'Dhaka', 'Chrome 145', 'Windows 10/11', 'Desktop', 0, 'SUCCESS', NULL, '2026-03-06 18:23:02'),
(13, '91d243f1-1490-11f1-8555-fc3497682340', 'it_satellite', 'it_satellite@gmail.com', 'MERCHANT', '13', NULL, 'LOGIN', '114.130.157.77', 'Bangladesh', 'Dhaka', 'Chrome 145', 'Windows 10/11', 'Desktop', 0, 'SUCCESS', NULL, '2026-03-07 16:07:41'),
(14, '5692d84f-1620-11f1-8555-fc3497682340', 'cao', 'cao.bangladeshisoftware@gmail.com', 'ADMIN', NULL, NULL, 'LOGIN', '114.130.157.77', 'Bangladesh', 'Dhaka', 'Chrome 145', 'Windows 10/11', 'Desktop', 0, 'SUCCESS', NULL, '2026-03-08 03:25:00');

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
  `nid` varchar(30) NOT NULL,
  `acc_no` varchar(30) NOT NULL,
  `daily_limit` varchar(12) NOT NULL DEFAULT '0',
  `single_transaction_limit` varchar(12) NOT NULL DEFAULT '0',
  `status` varchar(2) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `merchant`
--

INSERT INTO `merchant` (`id`, `display_name`, `first_name`, `middle_name`, `last_name`, `dob`, `fsp_id`, `id_type`, `id_value`, `nid`, `acc_no`, `daily_limit`, `single_transaction_limit`, `status`, `created_at`) VALUES
(13, 'IT Satellite', 'IT', 'Satellite', 'ITS', '2026-02-16', '', 'MSISDN', '01234567891', '4243488493434', '4839484547549595', '12000', '1000', '1', '2026-02-15 18:06:25'),
(14, 'Display Merchant', 'Display', 'Merchant ', 'DM', '2026-02-22', '', 'MSISDN', '01234567892', '4343432493369', '3925484547990023', '12000', '1000', '1', '2026-02-22 06:01:37');

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

--
-- Dumping data for table `merchant_balance`
--

INSERT INTO `merchant_balance` (`id`, `merchant_id`, `user_id`, `transaction_id`, `transfer_id`, `type`, `amount`, `fee`, `balance_before`, `balance_after`, `currency`, `note`, `created_at`, `updated_at`) VALUES
(1, '13', NULL, NULL, NULL, 'CREDIT', 2000.00, 0.00, 0.00, 2000.00, 'BDT', 'Account Opening Deposit.', '2026-03-02 13:54:16', '2026-03-02 12:05:53'),
(2, '14', NULL, NULL, NULL, 'CREDIT', 2000.00, 0.00, 0.00, 2000.00, 'BDT', 'Account Opening Deposit.', '2026-03-02 13:54:56', '2026-03-02 12:05:51'),
(5, '13', NULL, '9f6e776d-0824-4f6e-b6a3-ceb7914b8faf', '8acf0c86-b7a1-4eaf-aa89-d3cb0937919b', 'DEBIT', 10.00, 0.00, 2000.00, 1990.00, 'BDT', 'INSTANT sent to 01234567890', '2026-03-02 18:06:45', '2026-03-02 18:06:45'),
(6, '13', NULL, 'bf4e49e0-2b14-4c14-8d75-427f64ca75c9', '632def4d-c631-4cd1-9cc1-9c2520c02966', 'DEBIT', 30.00, 0.00, 1990.00, 1960.00, 'BDT', 'INSTANT sent to 01222222222', '2026-03-02 18:22:27', '2026-03-02 18:22:27'),
(7, '13', NULL, 'cc7d8402-1e3f-4341-943a-fb70920c81f8', '2f91ad01-0315-456c-8139-ebff06c33b00', 'DEBIT', 7.00, 0.00, 1960.00, 1953.00, 'BDT', 'INSTANT sent to 01233445566', '2026-03-03 08:18:54', '2026-03-03 08:18:54');

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

--
-- Dumping data for table `merchant_wallet`
--

INSERT INTO `merchant_wallet` (`id`, `merchant_id`, `user_id`, `balance`, `total_credit`, `total_debit`, `total_fee`, `currency`, `created_at`, `updated_at`) VALUES
(1, '13', NULL, 1953.00, 2000.00, 47.00, 0.00, 'BDT', '2026-03-02 13:54:16', '2026-03-03 08:18:54'),
(2, '14', NULL, 2000.00, 2000.00, 0.00, 0.00, 'BDT', '2026-03-02 13:54:56', '2026-03-02 12:06:03');

-- --------------------------------------------------------

--
-- Table structure for table `quote_logs`
--

CREATE TABLE `quote_logs` (
  `id` int(11) NOT NULL,
  `subject` varchar(100) DEFAULT NULL,
  `callback` varchar(255) DEFAULT NULL,
  `details` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `transactions`
--

INSERT INTO `transactions` (`id`, `transfer_id`, `quote_id`, `transaction_id`, `type`, `direction`, `payer_fsp`, `payee_fsp`, `payer_id_type`, `payer_id_value`, `payer_name`, `payee_id_type`, `payee_id_value`, `payee_name`, `merchant_id`, `initiated_by`, `amount`, `currency`, `fee`, `receive_amount`, `ilp_packet`, `condition_hash`, `fulfilment`, `expiration`, `status`, `error_code`, `error_description`, `quote_at`, `transfer_at`, `completed_at`, `created_at`, `updated_at`) VALUES
('2dd11eed-1a3f-11f1-8896-bc2411b07449', 'e8368540-e5af-44f1-adcb-ef5d7b6cee25', 'd207daaa-ccc8-4664-ac6a-2aac57c71cb3', '1723ecdd-bf1b-4409-af59-b3658c8bf28b', 'INSTANT', 'INCOMING', 'ABank', 'BBank', 'MSISDN', '01234567890', 'Echo s', 'MSISDN', '01234567892', NULL, NULL, NULL, 50.0000, 'BDT', 0.0000, 50.0000, 'eyJhbW91bnQiOiI1MCIsImN1cnJlbmN5IjoiQkRUIiwicGF5ZWUiOnsiaWQiOiIwMTIzNDU2Nzg5MiJ9LCJwYXllciI6eyJpZCI6IjAxMjM0NTY3ODkwIn0sImV4cGlyYXRpb24iOiIyMDI2LTAzLTA3VDE3OjAzOjE2LjgyOFoifQ==', 'Y7-UwOaxmk0yLn4BSfqUlBf68-2aWbIRzoi7nGWhhMc', NULL, '2026-03-07 17:03:16', 'COMMITTED', NULL, NULL, '2026-03-07 16:03:16', '2026-03-07 16:03:32', '2026-03-07 16:03:32', '2026-03-07 16:03:16', '2026-03-07 16:03:32'),
('452e5e37-1664-11f1-8896-bc2411b07449', '19abecd3-2c3d-4e07-8d72-4704fd9fc369', '11e2c3f1-7f9b-460d-a5b8-93cc0df419a3', '0c032ff4-446e-40f7-b86d-ec897acbb61c', 'P2P', 'INCOMING', 'ABank', 'BBank', 'MSISDN', '01222222222', 'Finance FIT', 'MSISDN', '01234567891', NULL, NULL, NULL, 20.0000, 'BDT', 0.0000, 20.0000, 'eyJhbW91bnQiOiIyMCIsImN1cnJlbmN5IjoiQkRUIiwicGF5ZWUiOnsiaWQiOiIwMTIzNDU2Nzg5MSJ9LCJwYXllciI6eyJpZCI6IjAxMjIyMjIyMjIyIn0sImV4cGlyYXRpb24iOiIyMDI2LTAzLTAyVDE5OjE4OjQ2LjE2M1oifQ==', 'jIR1LVjD4VF9ODsANMyZC7zMARWcIf1hpl00Vam-VZo', NULL, '2026-03-02 19:18:46', 'COMMITTED', NULL, NULL, '2026-03-02 18:18:46', '2026-03-02 18:18:58', '2026-03-02 18:18:59', '2026-03-02 18:18:46', '2026-03-02 18:18:59'),
('5041c1d1-17a4-11f1-8896-bc2411b07449', '11c93345-36f2-4843-b472-3cd8344d536a', 'f14fe0d5-b00e-4536-a55a-0767f174e1bb', 'ee914695-17fa-4509-b991-6315b60a18ff', 'INSTANT', 'INCOMING', 'ABank', 'BBank', 'MSISDN', '01222222222', 'Finance FIT', 'MSISDN', '01234567891', NULL, NULL, NULL, 8.0000, 'BDT', 0.0000, 8.0000, 'eyJhbW91bnQiOiI4IiwiY3VycmVuY3kiOiJCRFQiLCJwYXllZSI6eyJpZCI6IjAxMjM0NTY3ODkxIn0sInBheWVyIjp7ImlkIjoiMDEyMjIyMjIyMjIifSwiZXhwaXJhdGlvbiI6IjIwMjYtMDMtMDRUMDk6Mjk6NDIuODc0WiJ9', 'y77q0U9t2GGcA9VDBdyv7AibGsiBCYlgRWQ2GoFiSQo', NULL, '2026-03-04 09:29:42', 'COMMITTED', NULL, NULL, '2026-03-04 08:29:42', '2026-03-04 08:29:48', '2026-03-04 08:29:48', '2026-03-04 08:29:42', '2026-03-04 08:29:48'),
('8ac46945-1471-11f1-8555-fc3497682340', 'a25216d8-b414-4112-9b4f-906d0803f998', '835ef26f-825c-485a-8993-40e91a808f8e', 'c489ab17-9ffb-4119-a144-d1f82a86952f', 'P2P', 'INCOMING', 'ABank', 'BBank', 'MSISDN', '01234567890', 'Echo s', 'MSISDN', '01234567891', NULL, NULL, NULL, 5.0000, 'BDT', 0.0000, 5.0000, 'eyJhbW91bnQiOiI1IiwiY3VycmVuY3kiOiJCRFQiLCJwYXllZSI6eyJpZCI6IjAxMjM0NTY3ODkxIn0sInBheWVyIjp7ImlkIjoiMDEyMzQ1Njc4OTAifSwiZXhwaXJhdGlvbiI6IjIwMjYtMDItMjhUMDc6NDg6NTEuNzE5WiJ9', 'XYLQ0IQ9NVQg3lYUpt5_qzVYa5GQ6FSdm3wO-gDrN2s', NULL, '2026-02-28 08:48:52', 'COMMITTED', NULL, NULL, '2026-02-28 07:48:51', '2026-02-28 07:49:01', '2026-02-28 07:49:01', '2026-02-28 07:48:51', '2026-02-28 07:49:01'),
('8f5e6d4b-1662-11f1-8896-bc2411b07449', '8acf0c86-b7a1-4eaf-aa89-d3cb0937919b', '329be86b-74e2-4930-baf6-8b4570005bde', '9f6e776d-0824-4f6e-b6a3-ceb7914b8faf', 'INSTANT', 'OUTGOING', 'BBank', 'ABank', 'MSISDN', '01234567891', 'IT ITS', 'MSISDN', '01234567890', NULL, '13', NULL, 10.0000, 'BDT', 0.0000, 10.0000, 'eyJhbW91bnQiOiIxMCIsImN1cnJlbmN5IjoiQkRUIiwicGF5ZWUiOnsiaWQiOiIwMTIzNDU2Nzg5MCJ9LCJwYXllciI6eyJpZCI6IjAxMjM0NTY3ODkxIn0sImV4cGlyYXRpb24iOiIyMDI2LTAzLTAyVDE5OjA2OjMyLjk5N1oifQ==', 'OTw_n7xmHQPCyHxA65L-pkJF8_AKpitmENqqCM4fJaU', NULL, '2026-03-02 19:06:32', 'COMMITTED', NULL, NULL, '2026-03-02 18:06:31', '2026-03-02 18:06:43', '2026-03-02 18:06:45', '2026-03-02 18:06:31', '2026-03-02 18:06:45'),
('9b52b152-1989-11f1-8896-bc2411b07449', '5529e1a3-18a2-450f-9bda-7e8fe4db9994', 'c15bde9b-3e90-4dbc-8dea-69ff04012564', '90b2f278-a1a1-4283-b02b-4682e36bb961', 'P2P', 'INCOMING', 'ABank', 'BBank', 'MSISDN', '01234567890', 'Echo s', 'MSISDN', '01234567891', NULL, NULL, NULL, 100.0000, 'BDT', 0.0000, 100.0000, 'eyJhbW91bnQiOiIxMDAiLCJjdXJyZW5jeSI6IkJEVCIsInBheWVlIjp7ImlkIjoiMDEyMzQ1Njc4OTEifSwicGF5ZXIiOnsiaWQiOiIwMTIzNDU2Nzg5MCJ9LCJleHBpcmF0aW9uIjoiMjAyNi0wMy0wNlQxOToyMzozMi45MzJaIn0=', 'llp6NpL86_PgX0tBmAmf1AoMPu3LJgCDiUnGTC-kAN8', NULL, '2026-03-06 19:23:32', 'COMMITTED', NULL, NULL, '2026-03-06 18:23:32', '2026-03-06 18:23:45', '2026-03-06 18:23:47', '2026-03-06 18:23:32', '2026-03-06 18:23:47'),
('9c1560d0-16d9-11f1-8896-bc2411b07449', '2f91ad01-0315-456c-8139-ebff06c33b00', '49dc8628-4bc3-47e2-b44d-ffe6ea8a956e', 'cc7d8402-1e3f-4341-943a-fb70920c81f8', 'INSTANT', 'OUTGOING', 'BBank', 'ABank', 'MSISDN', '01234567891', 'IT ITS', 'MSISDN', '01233445566', NULL, '13', NULL, 7.0000, 'BDT', 0.0000, 7.0000, 'eyJhbW91bnQiOiI3IiwiY3VycmVuY3kiOiJCRFQiLCJwYXllZSI6eyJpZCI6IjAxMjMzNDQ1NTY2In0sInBheWVyIjp7ImlkIjoiMDEyMzQ1Njc4OTEifSwiZXhwaXJhdGlvbiI6IjIwMjYtMDMtMDNUMDk6MTg6NDMuOTM3WiJ9', 'uAJkrVFMZ7-rb07UbynA-pVPOf796b6_wMItoR7RJsk', NULL, '2026-03-03 09:18:43', 'COMMITTED', NULL, NULL, '2026-03-03 08:18:42', '2026-03-03 08:18:52', '2026-03-03 08:18:54', '2026-03-03 08:18:42', '2026-03-03 08:18:54'),
('b7d474b4-1989-11f1-8896-bc2411b07449', 'c3cfe7b6-724d-4432-9aea-8a7b36366611', 'f6fc5f0d-51a3-48a7-b5c6-878e295d8622', 'c1256ea5-fadd-456b-b64b-d70b9df63ed2', 'INSTANT', 'INCOMING', 'ABank', 'BBank', 'MSISDN', '01233445566', 'Blood Org', 'MSISDN', '01234567891', NULL, NULL, NULL, 100.0000, 'BDT', 0.0000, 100.0000, 'eyJhbW91bnQiOiIxMDAiLCJjdXJyZW5jeSI6IkJEVCIsInBheWVlIjp7ImlkIjoiMDEyMzQ1Njc4OTEifSwicGF5ZXIiOnsiaWQiOiIwMTIzMzQ0NTU2NiJ9LCJleHBpcmF0aW9uIjoiMjAyNi0wMy0wNlQxOToyNDoyMC43NThaIn0=', '277P4dOThuoaHrO7WS1rER8aG0UUfynO9NeiCnH6mVg', NULL, '2026-03-06 19:24:20', 'COMMITTED', NULL, NULL, '2026-03-06 18:24:20', '2026-03-06 18:24:27', '2026-03-06 18:24:28', '2026-03-06 18:24:20', '2026-03-06 18:24:28'),
('c177f4ec-1664-11f1-8896-bc2411b07449', '632def4d-c631-4cd1-9cc1-9c2520c02966', '8e28bbaf-5363-4c89-9441-73c8b8c06e32', 'bf4e49e0-2b14-4c14-8d75-427f64ca75c9', 'INSTANT', 'OUTGOING', 'BBank', 'ABank', 'MSISDN', '01234567891', 'IT ITS', 'MSISDN', '01222222222', NULL, '13', NULL, 30.0000, 'BDT', 0.0000, 30.0000, 'eyJhbW91bnQiOiIzMCIsImN1cnJlbmN5IjoiQkRUIiwicGF5ZWUiOnsiaWQiOiIwMTIyMjIyMjIyMiJ9LCJwYXllciI6eyJpZCI6IjAxMjM0NTY3ODkxIn0sImV4cGlyYXRpb24iOiIyMDI2LTAzLTAyVDE5OjIyOjE1LjgzMFoifQ==', '9h0oUwOeuCfakxXb4GAa6QTYRWWAQoHWaHQHbadN0Dc', NULL, '2026-03-02 19:22:15', 'COMMITTED', NULL, NULL, '2026-03-02 18:22:14', '2026-03-02 18:22:26', '2026-03-02 18:22:27', '2026-03-02 18:22:14', '2026-03-02 18:22:27'),
('e8e5a741-1637-11f1-8896-bc2411b07449', 'c56a917f-1971-4a97-9055-b2bdccf68717', '931a1364-280a-4c83-934d-34303510a071', 'a1728d51-f59e-45df-8ab2-508af2ac56d0', 'P2P', 'INCOMING', 'ABank', 'BBank', 'MSISDN', '01234567890', 'Echo s', 'MSISDN', '01234567891', NULL, NULL, NULL, 6.0000, 'BDT', 0.0000, 6.0000, 'eyJhbW91bnQiOiI2IiwiY3VycmVuY3kiOiJCRFQiLCJwYXllZSI6eyJpZCI6IjAxMjM0NTY3ODkxIn0sInBheWVyIjp7ImlkIjoiMDEyMzQ1Njc4OTAifSwiZXhwaXJhdGlvbiI6IjIwMjYtMDMtMDJUMTQ6MDE6MTMuNDgxWiJ9', 'J0VewQvoWlzX0dPqPyzKMsqFOzNf8bslxKfPdQ2Nmtw', NULL, '2026-03-02 14:01:13', 'COMMITTED', NULL, NULL, '2026-03-02 13:01:13', '2026-03-02 13:01:23', '2026-03-02 13:01:24', '2026-03-02 13:01:13', '2026-03-02 13:01:24');

-- --------------------------------------------------------

--
-- Table structure for table `transfers_logs`
--

CREATE TABLE `transfers_logs` (
  `id` int(11) NOT NULL,
  `subject` varchar(100) DEFAULT NULL,
  `callback` varchar(255) DEFAULT NULL,
  `details` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `email`, `password`, `full_name`, `phone`, `merchant_id`, `role`, `is_active`, `otp`, `otp_expires_at`, `last_login`, `created_at`, `updated_at`) VALUES
('3692t84f-1620-11f1-9555-fc3497682331', 'admin', 'ceo.bangladeshisoftware@gmail.com', '$2b$12$cwPB0KFgyKC7uglHiOH0OuXPpx0vxApPmdJmfNEmmssNtNF65q4SC', 'Admin', '01719182586', '', 'ADMIN', 1, NULL, NULL, '2026-03-06 17:31:17', '2026-03-02 11:12:37', '2026-03-06 17:31:17'),
('5692d84f-1620-11f1-8555-fc3497682340', 'cao', 'cao.bangladeshisoftware@gmail.com', '$2b$12$cwPB0KFgyKC7uglHiOH0OuXPpx0vxApPmdJmfNEmmssNtNF65q4SC', 'Admin', '01308983452', '', 'ADMIN', 1, NULL, NULL, '2026-03-08 03:25:00', '2026-03-02 11:12:37', '2026-03-08 03:25:00'),
('91d243f1-1490-11f1-8555-fc3497682340', 'it_satellite', 'it_satellite@gmail.com', '$2b$12$cwPB0KFgyKC7uglHiOH0OuXPpx0vxApPmdJmfNEmmssNtNF65q4SC', 'IT Satellite', '01234567891', '13', 'MERCHANT', 1, NULL, NULL, '2026-03-07 16:07:40', '2026-02-28 11:30:57', '2026-03-07 16:07:40'),
('91d24a01-1490-11f1-8555-fc3497682340', 'marchant_d', 'marchant_d@gmail.com', 'marchant_d', 'Merchant D', '01234567892', '14', 'MERCHANT', 1, NULL, NULL, NULL, '2026-02-28 11:30:57', '2026-02-28 11:36:55');

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
-- Indexes for table `quote_logs`
--
ALTER TABLE `quote_logs`
  ADD PRIMARY KEY (`id`);

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
-- Indexes for table `transfers_logs`
--
ALTER TABLE `transfers_logs`
  ADD PRIMARY KEY (`id`);

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `als_logs`
--
ALTER TABLE `als_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `merchant`
--
ALTER TABLE `merchant`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `merchant_balance`
--
ALTER TABLE `merchant_balance`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `merchant_wallet`
--
ALTER TABLE `merchant_wallet`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `quote_logs`
--
ALTER TABLE `quote_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `settings`
--
ALTER TABLE `settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `transfers_logs`
--
ALTER TABLE `transfers_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
