-- Adminer 4.6.3 MySQL dump

SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

DROP TABLE IF EXISTS `item`;
CREATE TABLE `item` (
  `title` varchar(128) NOT NULL,
  `status` enum('public','private') NOT NULL,
  PRIMARY KEY (`title`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;


DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `username` varchar(128) NOT NULL,
  `password` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

INSERT INTO `users` (`username`, `password`) VALUES
('grandcolline',	'grandcolline'),
('hidelberq',	'hidelberq'),
('hisanori',	'hidanori'),
('yokushiryoku',	'yokushiryoku');

-- 2018-11-06 14:00:45
