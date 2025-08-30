-- MySQL dump 10.13  Distrib 8.0.42, for Win64 (x86_64)
--
-- Host: localhost    Database: fiu_guidance_db
-- ------------------------------------------------------
-- Server version	9.3.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `academic_calendar_events`
--

DROP TABLE IF EXISTS `academic_calendar_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_calendar_events` (
  `event_id` int NOT NULL AUTO_INCREMENT,
  `upload_id` int NOT NULL,
  `event_type` varchar(50) NOT NULL DEFAULT 'academic_event',
  `event_name` varchar(255) NOT NULL,
  `event_name_en` varchar(255) DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `is_recurring` tinyint(1) DEFAULT '0',
  `recurring_type` varchar(50) NOT NULL DEFAULT 'none',
  `description` text,
  `affects_request_creation` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lunar_based` tinyint(1) DEFAULT '0' COMMENT 'Is this a lunar calendar based holiday (Bayram)',
  `priority_level` enum('low','medium','high','critical') DEFAULT 'medium' COMMENT 'Holiday priority for processing',
  `source_file` varchar(255) DEFAULT NULL COMMENT 'Source document filename',
  PRIMARY KEY (`event_id`),
  KEY `upload_id` (`upload_id`),
  KEY `idx_dates` (`start_date`,`end_date`),
  KEY `idx_event_type` (`event_type`),
  KEY `idx_affects_requests` (`affects_request_creation`),
  KEY `idx_calendar_date_range` (`start_date`,`end_date`,`affects_request_creation`),
  KEY `idx_events_date_range_affects` (`start_date`,`end_date`,`affects_request_creation`,`event_type`),
  CONSTRAINT `academic_calendar_events_ibfk_1` FOREIGN KEY (`upload_id`) REFERENCES `academic_calendar_uploads` (`upload_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=507 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_calendar_events`
--

LOCK TABLES `academic_calendar_events` WRITE;
/*!40000 ALTER TABLE `academic_calendar_events` DISABLE KEYS */;
INSERT INTO `academic_calendar_events` VALUES (403,27,'holiday','Mawlid al-Nabi (Religious Holiday)','Mawlid al-Nabi (Religious Holiday)','2024-09-15','2024-09-15',0,'none','Extracted from: 15 September 2024 | Mawlid al-Nabi (Religious Holiday)',1,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(404,27,'registration','Online Course Registration Period for Registered Students','Online Course Registration Period for Registered Students','2024-09-16','2024-09-20',0,'none','Extracted from: 16-20 September 2024 | Online Course Registration Period for Registered Students',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(405,27,'exam_period','English Proficiency Examination','English Proficiency Examination','2024-09-16','2024-09-20',0,'none','Extracted from: 16-20 September 2024 | English Proficiency Examination',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(406,27,'orientation','Orientation Program for New Students','Orientation Program for New Students','2024-09-16','2024-09-20',0,'none','Extracted from: 16-20 September 2024 | Orientation Program for New Students',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(407,27,'academic_event','Last Day to Apply for Minor and Double Major Programs','Last Day to Apply for Minor and Double Major Programs','2024-09-20','2024-09-20',0,'none','Extracted from: 20 September 2024 | Last Day to Apply for Minor and Double Major Programs',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(408,27,'academic_event','Last Day to Apply for Change of Program','Last Day to Apply for Change of Program','2024-09-20','2024-09-20',0,'none','Extracted from: 20 September 2024 | Last Day to Apply for Change of Program',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(409,27,'registration','Course Registration with Advisor Approval','Course Registration with Advisor Approval','2024-09-23','2024-09-27',0,'none','Extracted from: 23-27 September 2024 | Course Registration with Advisor Approval',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(410,27,'exam_period','Application for Exemption Examinations','Application for Exemption Examinations','2024-09-27','2024-09-29',0,'none','Extracted from: 27-29 September 2024 | Application for Exemption Examinations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(411,27,'semester_start','First Day of Classes','First Day of Classes','2024-09-30','2024-09-30',0,'none','Extracted from: 30 September 2024 | First Day of Classes',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(412,27,'registration','First Day for Late Registration (With Penalty)','First Day for Late Registration (With Penalty)','2024-09-30','2024-09-30',0,'none','Extracted from: 30 September 2024 | First Day for Late Registration (With Penalty)',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(413,27,'exam_period','Exemption Examinations','Exemption Examinations','2024-10-02','2024-10-04',0,'none','Extracted from: 02-04 October 2024 | Exemption Examinations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(414,27,'academic_event','Last Day to Apply for Course Exemptions','Last Day to Apply for Course Exemptions','2024-10-07','2024-10-07',0,'none','Extracted from: 07 October 2024 | Last Day to Apply for Course Exemptions',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(415,27,'academic_event','Last Day for Add and Drop of Courses','Last Day for Add and Drop of Courses','2024-10-11','2024-10-11',0,'none','Extracted from: 11 October 2024 | Last Day for Add and Drop of Courses',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(416,27,'registration','Last Day for Late Registration (With Penalty)','Last Day for Late Registration (With Penalty)','2024-10-11','2024-10-11',0,'none','Extracted from: 11 October 2024 | Last Day for Late Registration (With Penalty)',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(417,27,'exam_period','Last day for Application of Late Exemption Examinations','Last day for Application of Late Exemption Examinations','2024-10-11','2024-10-11',0,'none','Extracted from: 11 October 2024 | Last day for Application of Late Exemption Examinations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(418,27,'exam_period','Late Exemption Examinations','Late Exemption Examinations','2024-10-14','2024-10-15',0,'none','Extracted from: 14-15 October 2024 | Late Exemption Examinations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(419,27,'academic_event','Republic Day of Turkey (National Vacation)','Republic Day of Turkey (National Vacation)','2024-10-29','2024-10-29',1,'national','Extracted from: 29 October 2024 | Republic Day of Turkey (National Vacation)',1,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(420,27,'makeup_classes','Make-up of Classes That Could Not Be Held Due to Vacations','Make-up of Classes That Could Not Be Held Due to Vacations','2024-11-02','2024-11-02',0,'none','Extracted from: 02 November 2024 | Make-up of Classes That Could Not Be Held Due to Vacations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(421,27,'academic_event','Ataturk Memorial Day','Ataturk Memorial Day','2024-11-10','2024-11-10',1,'none','Extracted from: 10 November 2024 | Ataturk Memorial Day',1,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(422,27,'academic_event','Republic Day of the TRNC (National Vacation)','Republic Day of the TRNC (National Vacation)','2024-11-15','2024-11-15',1,'national','Extracted from: 15 November 2024 | Republic Day of the TRNC (National Vacation)',1,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(423,27,'exam_period','Mid-term Examinations','Mid-term Examinations','2024-11-16','2024-11-24',0,'none','Extracted from: 16-24 November 2024 | Mid-term Examinations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(424,27,'makeup_classes','Make-up of Classes That Could Not Be Held Due to Vacations','Make-up of Classes That Could Not Be Held Due to Vacations','2024-11-30','2024-11-30',0,'none','Extracted from: 30 November 2024 | Make-up of Classes That Could Not Be Held Due to Vacations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(425,27,'academic_event','Last Day for Course Withdrawal','Last Day for Course Withdrawal','2024-12-20','2024-12-20',0,'none','Extracted from: 20 December 2024 | Last Day for Course Withdrawal',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(426,27,'academic_event','Christmas Day','Christmas Day','2024-12-25','2024-12-25',1,'intl','Extracted from: 25 December 2024 | Christmas Day',1,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(427,27,'academic_event','New Year’s Day (Vacation)','New Year’s Day (Vacation)','2025-01-01','2025-01-01',1,'intl','Extracted from: 01 January 2025 | New Year’s Day (Vacation)',1,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(428,27,'makeup_classes','Make-up of Classes That Could Not Be Held Due to Vacations','Make-up of Classes That Could Not Be Held Due to Vacations','2025-01-04','2025-01-04',0,'none','Extracted from: 04 January 2025 | Make-up of Classes That Could Not Be Held Due to Vacations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(429,27,'semester_end','Last Day of Classes','Last Day of Classes','2025-01-11','2025-01-11',0,'none','Extracted from: 11 January 2025 | Last Day of Classes',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(430,27,'exam_period','Final Examinations','Final Examinations','2025-01-12','2025-01-22',0,'none','Extracted from: 12-22 January 2025 | Final Examinations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(431,27,'exam_period','English Proficiency Examination','English Proficiency Examination','2025-01-20','2025-01-23',0,'none','Extracted from: 20-23 January 2025 | English Proficiency Examination',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(432,27,'academic_event','Last Day for the Submission and Announcement of Semester Grades on SIS','Last Day for the Submission and Announcement of Semester Grades on SIS','2025-01-24','2025-01-24',0,'none','Extracted from: 24 January 2025 | Last Day for the Submission and Announcement of Semester Grades on SIS',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(433,27,'exam_period','Application for Re-sit Examinations','Application for Re-sit Examinations','2025-01-25','2025-01-27',0,'none','Extracted from: 25-27 January 2025 | Application for Re-sit Examinations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(434,27,'exam_period','Re-sit and Make-up Examinations','Re-sit and Make-up Examinations','2025-01-28','2025-01-29',0,'none','Extracted from: 28-29 January 2025 | Re-sit and Make-up Examinations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(435,27,'academic_event','Last Day for Submission and Announcement of the Re-Sit and MakeUp','Last Day for Submission and Announcement of the Re-Sit and MakeUp','2025-01-30','2025-01-30',0,'none','Extracted from: 30 January 2025 | Last Day for Submission and Announcement of the Re-Sit and MakeUp',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(436,27,'exam_period','Examination Grades on SIS','Examination Grades on SIS','2025-01-30','2025-01-30',0,'none','Extracted from: 30 January 2025 | Examination Grades on SIS',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(437,27,'exam_period','Re-sit Examinations for Students Who Failed Their Courses After the Make-up','Re-sit Examinations for Students Who Failed Their Courses After the Make-up','2025-01-31','2025-01-31',0,'none','Extracted from: 31 January 2025 | Re-sit Examinations for Students Who Failed Their Courses After the Make-up',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(438,27,'exam_period','Examinations','Examinations','2025-01-31','2025-01-31',0,'none','Extracted from: 31 January 2025 | Examinations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(439,27,'exam_period','Last day for Submission and Announcement of Re-Sit Exam Grades of Students','Last day for Submission and Announcement of Re-Sit Exam Grades of Students','2025-02-03','2025-02-03',0,'none','Extracted from: 03 February 2025 | Last day for Submission and Announcement of Re-Sit Exam Grades of Students',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(440,27,'exam_period','Who Failed After Make-up Exams on SIS','Who Failed After Make-up Exams on SIS','2025-02-03','2025-02-03',0,'none','Extracted from: 03 February 2025 | Who Failed After Make-up Exams on SIS',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(441,27,'academic_event','04 February2025','04 February2025','2025-02-03','2025-02-03',0,'none','Extracted from: 03 February 2025 | 04 February2025',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(442,27,'exam_period','Graduation Make-up Exam Applications','Graduation Make-up Exam Applications','2025-02-03','2025-02-03',0,'none','Extracted from: 03 February 2025 | Graduation Make-up Exam Applications',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(443,27,'exam_period','Graduation Make-up Exams','Graduation Make-up Exams','2025-02-05','2025-02-05',0,'none','Extracted from: 05 February 2025 | Graduation Make-up Exams',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(444,27,'exam_period','Last day for submission of Graduation Make-up Exam results','Last day for submission of Graduation Make-up Exam results','2025-02-06','2025-02-06',0,'none','Extracted from: 06 February 2025 | Last day for submission of Graduation Make-up Exam results',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(445,27,'academic_event','Except for Turkish students who come with YKS, DGS and international new students who register late','Except for Turkish students who come with YKS, DGS and international new students who register late','2025-02-06','2025-02-06',0,'none','Extracted from: 06 February 2025 | Except for Turkish students who come with YKS, DGS and international new students who register late',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(446,27,'academic_event','Classes wil be held face-to-face but Attendance will not be taken and courses will not be evaluated.','Classes wil be held face-to-face but Attendance will not be taken and courses will not be evaluated.','2025-02-06','2025-02-06',0,'none','Extracted from: 06 February 2025 | Classes wil be held face-to-face but Attendance will not be taken and courses will not be evaluated.',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(447,27,'registration','Online Course Registration Period for Registered Students','Online Course Registration Period for Registered Students','2025-02-07','2025-02-10',0,'none','Extracted from: 07-10 February 2025 | Online Course Registration Period for Registered Students',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(448,27,'academic_event','Last Day to Apply for Minor and Double Major Programs','Last Day to Apply for Minor and Double Major Programs','2025-02-10','2025-02-10',0,'none','Extracted from: 10 February 2025 | Last Day to Apply for Minor and Double Major Programs',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(449,27,'academic_event','Last Day to Apply for Change of Program','Last Day to Apply for Change of Program','2025-02-10','2025-02-10',0,'none','Extracted from: 10 February 2025 | Last Day to Apply for Change of Program',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(450,27,'exam_period','English Proficiency Examination for New Students','English Proficiency Examination for New Students','2025-02-10','2025-02-14',0,'none','Extracted from: 10-14 February 2025 | English Proficiency Examination for New Students',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(451,27,'orientation','Orientation for All New Students','Orientation for All New Students','2025-02-10','2025-02-14',0,'none','Extracted from: 10-14 February 2025 | Orientation for All New Students',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(452,27,'registration','Course Registration with Advisor Approval','Course Registration with Advisor Approval','2025-02-10','2025-02-14',0,'none','Extracted from: 10-14 February 2025 | Course Registration with Advisor Approval',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(453,27,'exam_period','Application for Exemption Examinations','Application for Exemption Examinations','2025-02-15','2025-02-16',0,'none','Extracted from: 15-16 February 2025 | Application for Exemption Examinations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(454,27,'academic_event','17 Şubat 2025','17 Şubat 2025','2025-02-15','2025-02-16',0,'none','Extracted from: 15-16 February 2025 | 17 Şubat 2025',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(455,27,'semester_start','First Day of Classes','First Day of Classes','2025-02-15','2025-02-16',0,'none','Extracted from: 15-16 February 2025 | First Day of Classes',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(456,27,'registration','First Day for Late Registration (with Penalty)','First Day for Late Registration (with Penalty)','2025-02-15','2025-02-16',0,'none','Extracted from: 15-16 February 2025 | First Day for Late Registration (with Penalty)',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(457,27,'exam_period','Exemption Examinations','Exemption Examinations','2025-02-18','2025-02-21',0,'none','Extracted from: 18-21 February 2025 | Exemption Examinations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(458,27,'application','Last Day for Course Exemption Applications','Last Day for Course Exemption Applications','2025-02-24','2025-02-24',0,'none','Extracted from: 24 February 2025 | Last Day for Course Exemption Applications',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(459,27,'registration','Last Day for Late Registration (with Penalty)','Last Day for Late Registration (with Penalty)','2025-02-28','2025-02-28',0,'none','Extracted from: 28 February 2025 | Last Day for Late Registration (with Penalty)',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(460,27,'academic_event','Last day for Add and Drop of courses','Last day for Add and Drop of courses','2025-02-28','2025-02-28',0,'none','Extracted from: 28 February 2025 | Last day for Add and Drop of courses',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(461,27,'exam_period','Last day for Application of Late Exemption Examinations','Last day for Application of Late Exemption Examinations','2025-02-28','2025-02-28',0,'none','Extracted from: 28 February 2025 | Last day for Application of Late Exemption Examinations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(462,27,'exam_period','Late Exemption Examinations','Late Exemption Examinations','2025-03-03','2025-03-04',0,'none','Extracted from: 03-04 March 2025 | Late Exemption Examinations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(463,27,'academic_event','29 March','29 March','2025-04-01','2025-04-01',0,'none','Extracted from: 29 March-01 April 2025 | 29 March-',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(464,27,'holiday','Arife and Ramazan Bayram (Holiday)','Arife and Ramazan Bayram (Holiday)','2025-04-01','2025-04-01',0,'eid_fitr','Extracted from: 29 March-01 April 2025 | Arife and Ramazan Bayram (Holiday)',1,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(465,27,'exam_period','Mid-term Examinations','Mid-term Examinations','2025-04-05','2025-04-13',0,'none','Extracted from: 05-13 April 2025 | Mid-term Examinations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(466,27,'makeup_classes','Make-up of Classes That Could Not Be Held Due to Vacations','Make-up of Classes That Could Not Be Held Due to Vacations','2025-04-19','2025-04-20',0,'none','Extracted from: 19-20 April 2025 | Make-up of Classes That Could Not Be Held Due to Vacations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(467,27,'academic_event','National Sovereignty and Children’s Day (National Vacation)','National Sovereignty and Children’s Day (National Vacation)','2025-04-23','2025-04-23',1,'none','Extracted from: 23 April 2025 | National Sovereignty and Children’s Day (National Vacation)',1,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(468,27,'academic_event','Labour Day (Vacation)','Labour Day (Vacation)','2025-05-01','2025-05-01',0,'none','Extracted from: 01 May 2025 | Labour Day (Vacation)',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(469,27,'makeup_classes','Make-up of Classes That Could Not Be Held Due to Vacations','Make-up of Classes That Could Not Be Held Due to Vacations','2025-05-03','2025-05-04',0,'none','Extracted from: 03-04 May 2025 | Make-up of Classes That Could Not Be Held Due to Vacations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(470,27,'academic_event','Last Day for Course Withdrawal','Last Day for Course Withdrawal','2025-05-09','2025-05-09',0,'none','Extracted from: 09 May 2025 | Last Day for Course Withdrawal',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(471,27,'makeup_classes','Make-up of Classes That Could Not Be Held Due to Vacations','Make-up of Classes That Could Not Be Held Due to Vacations','2025-05-10','2025-05-11',0,'none','Extracted from: 10-11 May 2025 | Make-up of Classes That Could Not Be Held Due to Vacations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(472,27,'makeup_classes','Make-up of Classes That Could Not Be Held Due to Vacations','Make-up of Classes That Could Not Be Held Due to Vacations','2025-05-17','2025-05-18',0,'none','Extracted from: 17-18 May 2025 | Make-up of Classes That Could Not Be Held Due to Vacations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(473,27,'academic_event','Youth and Sports Day (National Vacation)','Youth and Sports Day (National Vacation)','2025-05-19','2025-05-19',0,'none','Extracted from: 19 May 2025 | Youth and Sports Day (National Vacation)',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(474,27,'makeup_classes','Make-up of Classes That Could Not Be Held Due to Vacations','Make-up of Classes That Could Not Be Held Due to Vacations','2025-05-24','2025-05-24',0,'none','Extracted from: 24 May 2025 | Make-up of Classes That Could Not Be Held Due to Vacations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(475,27,'semester_end','Last Day of Classes','Last Day of Classes','2025-05-24','2025-05-24',0,'none','Extracted from: 24 May 2025 | Last Day of Classes',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(476,27,'academic_event','25 May','25 May','2025-06-04','2025-06-04',0,'none','Extracted from: 25 May-04 June 2025 | 25 May-',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(477,27,'exam_period','Final Examinations','Final Examinations','2025-06-04','2025-06-04',0,'none','Extracted from: 25 May-04 June 2025 | Final Examinations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(478,27,'exam_period','English Proficiency Exam','English Proficiency Exam','2025-06-04','2025-06-04',0,'none','Extracted from: 25 May-04 June 2025 | English Proficiency Exam',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(479,27,'holiday','Arife and Kurban Bayram (Holiday)','Arife and Kurban Bayram (Holiday)','2025-06-05','2025-06-09',0,'eid_adha','Extracted from: 05-09 June 2025 | Arife and Kurban Bayram (Holiday)',1,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(480,27,'academic_event','Last Day for the Submission and Announcement of Letter Grades (SIS)','Last Day for the Submission and Announcement of Letter Grades (SIS)','2025-06-11','2025-06-11',0,'none','Extracted from: 11 June 2025 | Last Day for the Submission and Announcement of Letter Grades (SIS)',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(481,27,'exam_period','Application for Re-sit Examinations','Application for Re-sit Examinations','2025-06-12','2025-06-13',0,'none','Extracted from: 12-13 June 2025 | Application for Re-sit Examinations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(482,27,'exam_period','Re-sit and Make-up Examinations','Re-sit and Make-up Examinations','2025-06-16','2025-06-17',0,'none','Extracted from: 16-17 June 2025 | Re-sit and Make-up Examinations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(483,27,'academic_event','Last Day for Submission and Announcement of Re-Sit and MakeUp','Last Day for Submission and Announcement of Re-Sit and MakeUp','2025-06-18','2025-06-18',0,'none','Extracted from: 18 June 2025 | Last Day for Submission and Announcement of Re-Sit and MakeUp',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(484,27,'exam_period','Examination Grades on SIS','Examination Grades on SIS','2025-06-18','2025-06-18',0,'none','Extracted from: 18 June 2025 | Examination Grades on SIS',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(485,27,'exam_period','Re-sit Examinations for Students Who Failed Their Courses After the Make','Re-sit Examinations for Students Who Failed Their Courses After the Make','2025-06-19','2025-06-19',0,'none','Extracted from: 19 June 2025 | Re-sit Examinations for Students Who Failed Their Courses After the Make',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(486,27,'exam_period','up Examinations','up Examinations','2025-06-19','2025-06-19',0,'none','Extracted from: 19 June 2025 | up Examinations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(487,27,'graduation','Graduation Ceremony','Graduation Ceremony','2025-06-19','2025-06-19',0,'none','Extracted from: 19 June 2025 | Graduation Ceremony',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(488,27,'exam_period','Last day for Submission and Announcement of Re-Sit Exam Grades of','Last day for Submission and Announcement of Re-Sit Exam Grades of','2025-06-20','2025-06-20',0,'none','Extracted from: 20 June 2025 | Last day for Submission and Announcement of Re-Sit Exam Grades of',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(489,27,'exam_period','Students Who Fail After Make-up Exams on SIS','Students Who Fail After Make-up Exams on SIS','2025-06-20','2025-06-20',0,'none','Extracted from: 20 June 2025 | Students Who Fail After Make-up Exams on SIS',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(490,27,'exam_period','Graduation Make-up Exam Applications','Graduation Make-up Exam Applications','2025-06-20','2025-06-21',0,'none','Extracted from: 20-21 June 2025 | Graduation Make-up Exam Applications',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(491,27,'exam_period','Graduation Make-up Exams','Graduation Make-up Exams','2025-06-23','2025-06-23',0,'none','Extracted from: 23 June 2025 | Graduation Make-up Exams',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(492,27,'exam_period','Last day for submission of Graduation Make-up Exam results','Last day for submission of Graduation Make-up Exam results','2025-06-24','2025-06-24',0,'none','Extracted from: 24 June 2025 | Last day for submission of Graduation Make-up Exam results',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(493,27,'academic_event','Except for Turkish students who come with YKS, DGS and international new students who register late','Except for Turkish students who come with YKS, DGS and international new students who register late','2025-06-24','2025-06-24',0,'none','Extracted from: 24 June 2025 | Except for Turkish students who come with YKS, DGS and international new students who register late',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(494,27,'registration','Course Registration with Advisor Approval','Course Registration with Advisor Approval','2025-06-25','2025-06-27',0,'none','Extracted from: 25-27 June 2025 | Course Registration with Advisor Approval',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(495,27,'semester_start','First Day of Classes','First Day of Classes','2025-06-30','2025-06-30',0,'none','Extracted from: 30 June 2025 | First Day of Classes',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(496,27,'registration','First Day for Late Registration (with Penalty)','First Day for Late Registration (with Penalty)','2025-06-30','2025-06-30',0,'none','Extracted from: 30 June 2025 | First Day for Late Registration (with Penalty)',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(497,27,'registration','Last Day for Late Registration (with Penalty)','Last Day for Late Registration (with Penalty)','2025-07-08','2025-07-08',0,'none','Extracted from: 08 July 2025 | Last Day for Late Registration (with Penalty)',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(498,27,'academic_event','Peace and Freedom Day of TRNC (National Vacation)','Peace and Freedom Day of TRNC (National Vacation)','2025-07-20','2025-07-20',0,'none','Extracted from: 20 July 2025 | Peace and Freedom Day of TRNC (National Vacation)',1,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(499,27,'academic_event','Communal Resistance Day (National Vacation)','Communal Resistance Day (National Vacation)','2025-08-01','2025-08-01',0,'none','Extracted from: 01 August 2025 | Communal Resistance Day (National Vacation)',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(500,27,'makeup_classes','Make-up of Classes That Could Not Be Held Due to Vacations','Make-up of Classes That Could Not Be Held Due to Vacations','2025-08-09','2025-08-10',0,'none','Extracted from: 09-10 August 2025 | Make-up of Classes That Could Not Be Held Due to Vacations',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(501,27,'holiday','holiday','holiday','2025-08-14','2025-08-14',0,'none','Extracted from: 14 August 2025 | holiday',1,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(502,27,'academic_event','Deadline for Submission and Announcement of Letter Grades on SIS','Deadline for Submission and Announcement of Letter Grades on SIS','2025-08-22','2025-08-22',0,'none','Extracted from: 22 August 2025 | Deadline for Submission and Announcement of Letter Grades on SIS',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(503,27,'exam_period','Last Day for Graduation Make-up Exam Applications','Last Day for Graduation Make-up Exam Applications','2025-08-25','2025-08-25',0,'none','Extracted from: 25 August 2025 | Last Day for Graduation Make-up Exam Applications',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(504,27,'exam_period','Graduation Make-up Exams','Graduation Make-up Exams','2025-08-26','2025-08-26',0,'none','Extracted from: 26 August 2025 | Graduation Make-up Exams',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(505,27,'exam_period','Last day for submission of Graduation Make-up Exam results','Last day for submission of Graduation Make-up Exam results','2025-08-27','2025-08-27',0,'none','Extracted from: 27 August 2025 | Last day for submission of Graduation Make-up Exam results',0,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL),(506,27,'academic_event','Victory Day of Turkey (National Vacation)','Victory Day of Turkey (National Vacation)','2025-08-30','2025-08-30',1,'none','Extracted from: 30 August 2025 | Victory Day of Turkey (National Vacation)',1,'2025-08-14 11:52:00','2025-08-14 11:52:00',0,'medium',NULL);
/*!40000 ALTER TABLE `academic_calendar_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academic_calendar_uploads`
--

DROP TABLE IF EXISTS `academic_calendar_uploads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_calendar_uploads` (
  `upload_id` int NOT NULL AUTO_INCREMENT,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_type` varchar(100) NOT NULL,
  `file_size` bigint NOT NULL,
  `academic_year` varchar(20) NOT NULL,
  `uploaded_by` int NOT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) DEFAULT '1',
  `processing_status` enum('pending','processing','completed','failed') DEFAULT 'pending',
  `processing_notes` text,
  PRIMARY KEY (`upload_id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `idx_academic_year` (`academic_year`),
  KEY `idx_active` (`is_active`),
  KEY `idx_status` (`processing_status`),
  KEY `idx_upload_status` (`is_active`,`processing_status`,`academic_year`),
  KEY `idx_uploads_year_status` (`academic_year`,`processing_status`,`is_active`),
  CONSTRAINT `academic_calendar_uploads_ibfk_1` FOREIGN KEY (`uploaded_by`) REFERENCES `admin_users` (`admin_id`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_calendar_uploads`
--

LOCK TABLES `academic_calendar_uploads` WRITE;
/*!40000 ALTER TABLE `academic_calendar_uploads` DISABLE KEYS */;
INSERT INTO `academic_calendar_uploads` VALUES (27,'FIU_2024_2025_AkademicCalendar_Eng.docx','calendar-1755172319958-137106666-FIU_2024_2025_AkademicCalendar_Eng.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',23751,'2024-2025',11,'2025-08-14 11:51:59',1,'completed','Successfully processed 104 events');
/*!40000 ALTER TABLE `academic_calendar_uploads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academic_settings`
--

DROP TABLE IF EXISTS `academic_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_settings` (
  `setting_id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text NOT NULL,
  `description` text,
  `updated_by` int DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_id`),
  UNIQUE KEY `setting_key` (`setting_key`),
  KEY `updated_by` (`updated_by`),
  KEY `idx_key` (`setting_key`),
  CONSTRAINT `academic_settings_ibfk_1` FOREIGN KEY (`updated_by`) REFERENCES `admin_users` (`admin_id`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_settings`
--

LOCK TABLES `academic_settings` WRITE;
/*!40000 ALTER TABLE `academic_settings` DISABLE KEYS */;
INSERT INTO `academic_settings` VALUES (1,'current_academic_year','2024-2025','Currently active academic year',11,'2025-08-22 08:40:33'),(2,'academic_calendar_enabled','true','Enable/disable academic calendar restrictions',11,'2025-08-22 08:40:33'),(3,'holiday_buffer_hours','24','Hours before/after holidays when requests are also blocked',11,'2025-08-22 08:40:33');
/*!40000 ALTER TABLE `academic_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academic_year_transitions`
--

DROP TABLE IF EXISTS `academic_year_transitions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_year_transitions` (
  `transition_id` int NOT NULL AUTO_INCREMENT,
  `from_academic_year` varchar(20) NOT NULL,
  `to_academic_year` varchar(20) NOT NULL,
  `transition_date` date NOT NULL,
  `is_active` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transition_id`),
  KEY `idx_academic_years` (`from_academic_year`,`to_academic_year`),
  KEY `idx_transition_date` (`transition_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_year_transitions`
--

LOCK TABLES `academic_year_transitions` WRITE;
/*!40000 ALTER TABLE `academic_year_transitions` DISABLE KEYS */;
/*!40000 ALTER TABLE `academic_year_transitions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `active_calendar_events`
--

DROP TABLE IF EXISTS `active_calendar_events`;
/*!50001 DROP VIEW IF EXISTS `active_calendar_events`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `active_calendar_events` AS SELECT 
 1 AS `event_id`,
 1 AS `upload_id`,
 1 AS `event_type`,
 1 AS `event_name`,
 1 AS `event_name_en`,
 1 AS `start_date`,
 1 AS `end_date`,
 1 AS `is_recurring`,
 1 AS `recurring_type`,
 1 AS `description`,
 1 AS `affects_request_creation`,
 1 AS `created_at`,
 1 AS `updated_at`,
 1 AS `academic_year`,
 1 AS `source_file`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `admin_performance_view`
--

DROP TABLE IF EXISTS `admin_performance_view`;
/*!50001 DROP VIEW IF EXISTS `admin_performance_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `admin_performance_view` AS SELECT 
 1 AS `admin_id`,
 1 AS `username`,
 1 AS `full_name`,
 1 AS `name`,
 1 AS `email`,
 1 AS `department`,
 1 AS `is_super_admin`,
 1 AS `is_active`,
 1 AS `admin_since`,
 1 AS `total_assigned_requests`,
 1 AS `completed_requests`,
 1 AS `pending_requests`,
 1 AS `informed_requests`,
 1 AS `rejected_requests`,
 1 AS `total_responses`,
 1 AS `completion_rate`,
 1 AS `avg_response_time_hours`,
 1 AS `current_pending`,
 1 AS `current_informed`,
 1 AS `workload_score`,
 1 AS `first_assignment`,
 1 AS `last_assignment`,
 1 AS `first_response`,
 1 AS `last_response`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `admin_responses`
--

DROP TABLE IF EXISTS `admin_responses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_responses` (
  `response_id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `admin_id` int DEFAULT NULL,
  `response_content` text NOT NULL,
  `is_internal` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`response_id`),
  KEY `idx_admin_responses_request_id` (`request_id`),
  KEY `idx_admin_responses_admin_id` (`admin_id`),
  CONSTRAINT `admin_responses_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `guidance_requests` (`request_id`) ON DELETE CASCADE,
  CONSTRAINT `admin_responses_ibfk_2` FOREIGN KEY (`admin_id`) REFERENCES `admin_users` (`admin_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_responses`
--

LOCK TABLES `admin_responses` WRITE;
/*!40000 ALTER TABLE `admin_responses` DISABLE KEYS */;
INSERT INTO `admin_responses` VALUES (1,1,1,'dneme',0,'2025-07-30 12:15:32','2025-08-11 11:24:31'),(2,2,1,'Request has been rejected.\n\nReason: deneme 123 1231 1234 214',0,'2025-08-03 10:35:39','2025-08-11 11:24:31'),(3,6,1,'Request has been rejected.\n\nReason: Student not eligible for this service',0,'2025-08-03 10:56:42','2025-08-11 11:24:31'),(4,10,1,'DENEME  RESPONSEE',0,'2025-08-04 06:16:49','2025-08-11 11:24:31'),(5,10,1,'Request has been rejected.\n\nReason: Application deadline has passed',0,'2025-08-04 06:17:14','2025-08-11 11:24:31'),(6,9,1,'Request has been rejected.\n\nReason: RECEJT DENEME 12345566',0,'2025-08-04 06:44:52','2025-08-11 11:24:31'),(7,4,1,'Request has been rejected.\n\nReason: aaaaaaaaaaaaaa',0,'2025-08-04 07:52:57','2025-08-11 11:24:31'),(8,12,NULL,'asfdayftuayf',0,'2025-08-04 11:17:14','2025-08-11 11:24:31'),(9,14,12,'deneme123',0,'2025-08-05 09:48:43','2025-08-11 11:24:31'),(10,13,12,'denem34566',0,'2025-08-05 09:49:01','2025-08-11 11:24:31'),(11,16,NULL,'asdfhrsh',0,'2025-08-05 11:12:46','2025-08-14 11:45:45'),(12,20,NULL,'grfshrhrw',0,'2025-08-05 11:12:56','2025-08-14 11:45:45'),(13,18,5,'ashrrehg',0,'2025-08-05 11:13:49','2025-08-11 11:24:31'),(14,19,3,'sjkyyyjy',0,'2025-08-05 11:14:42','2025-08-11 11:24:31'),(15,17,2,'aaaaaaaaaaaaaa',0,'2025-08-05 11:15:31','2025-08-11 11:24:31'),(16,24,13,'asfsf',0,'2025-08-10 08:01:32','2025-08-11 11:24:31'),(17,24,13,'Request has been rejected.\n\nReason: Request exceeds department policy limits',0,'2025-08-10 08:01:49','2025-08-11 11:24:31'),(18,32,2,'Request has been rejected.\n\nReason: Incomplete information provided',0,'2025-08-11 07:27:38','2025-08-11 11:24:31'),(19,31,2,'aaaaa',0,'2025-08-11 07:27:48','2025-08-11 11:24:31'),(20,33,13,'Request has been rejected.\n\nReason: Request does not meet department criteria',0,'2025-08-11 07:28:38','2025-08-11 11:24:31'),(21,23,1,'Request has been rejected.\n\nReason: Request submitted to wrong department',0,'2025-08-11 08:24:57','2025-08-11 11:24:31'),(22,20,NULL,'Request has been rejected.\n\nReason: Missing required documents',0,'2025-08-11 08:26:28','2025-08-14 11:45:45'),(23,21,3,'Request has been rejected.\n\nReason: Missing required documents',0,'2025-08-11 08:29:31','2025-08-11 11:24:31'),(24,40,5,'deneneeee',0,'2025-08-12 10:57:26','2025-08-12 10:57:26'),(25,41,11,'aaaaaaaaaaaaa',0,'2025-08-14 11:43:53','2025-08-14 11:43:53'),(26,43,1,'refund request',0,'2025-08-21 07:06:44','2025-08-21 07:06:44'),(27,46,1,'Request has been rejected.\n\nReason: Incomplete information provided',0,'2025-08-26 08:12:18','2025-08-26 08:12:18');
/*!40000 ALTER TABLE `admin_responses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_users`
--

DROP TABLE IF EXISTS `admin_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_users` (
  `admin_id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `department` varchar(255) DEFAULT NULL,
  `role` varchar(50) DEFAULT 'admin',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_super_admin` tinyint(1) DEFAULT '0',
  `last_role_update` timestamp NULL DEFAULT NULL,
  `role_updated_by` int DEFAULT NULL,
  PRIMARY KEY (`admin_id`),
  UNIQUE KEY `username` (`username`),
  KEY `idx_admin_users_department` (`department`),
  KEY `idx_admin_users_super` (`is_super_admin`),
  KEY `idx_admin_users_department_active` (`department`,`is_active`),
  KEY `fk_admin_role_updated_by` (`role_updated_by`),
  CONSTRAINT `admin_users_ibfk_1` FOREIGN KEY (`role_updated_by`) REFERENCES `admin_users` (`admin_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_admin_role_updated_by` FOREIGN KEY (`role_updated_by`) REFERENCES `admin_users` (`admin_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_users`
--

LOCK TABLES `admin_users` WRITE;
/*!40000 ALTER TABLE `admin_users` DISABLE KEYS */;
INSERT INTO `admin_users` VALUES (1,'accounting_admin','$2a$10$6RN92S26/UkUDCYk2tR/I.cE.V6LJLOhz0mDk53/1OzsGyjLNAd0u','Accounting Administrator','Accounting Admin','accounting@fiu.edu.tr','Accounting','admin',1,'2025-07-27 13:15:07','2025-08-04 12:51:24',0,'2025-08-04 12:51:24',11),(2,'academic_admin','$2a$10$6RN92S26/UkUDCYk2tR/I.cE.V6LJLOhz0mDk53/1OzsGyjLNAd0u','Academic Administrator','Academic Admin','academic@fiu.edu.tr','Academic','admin',1,'2025-07-27 13:15:07','2025-08-26 08:09:01',0,'2025-08-26 08:09:01',11),(3,'student_affairs_admin','$2a$10$6RN92S26/UkUDCYk2tR/I.cE.V6LJLOhz0mDk53/1OzsGyjLNAd0u','Student Affairs Administrator','Student Affairs Admin','studentaffairs@fiu.edu.tr','Student Affairs','admin',1,'2025-07-27 13:15:07','2025-07-27 13:15:07',0,NULL,NULL),(4,'dormitory_admin','$2a$10$6RN92S26/UkUDCYk2tR/I.cE.V6LJLOhz0mDk53/1OzsGyjLNAd0u','Dormitory Administrator','Dormitory Admin','dormitory@fiu.edu.tr','Dormitory','admin',0,'2025-07-27 13:15:07','2025-08-14 11:45:45',0,NULL,NULL),(5,'campus_services_admin','$2a$10$6RN92S26/UkUDCYk2tR/I.cE.V6LJLOhz0mDk53/1OzsGyjLNAd0u','Campus Services Administrator','Campus Services Admin','campusservices@fiu.edu.tr','Campus Services','admin',1,'2025-07-27 13:15:07','2025-08-04 12:51:31',0,'2025-08-04 12:51:31',11),(11,'superadmin','$2a$10$6RN92S26/UkUDCYk2tR/I.cE.V6LJLOhz0mDk53/1OzsGyjLNAd0u','System Super Administrator','System Super Administrator','superadmin@fiu.edu.tr','','super_admin',1,'2025-08-04 12:09:22','2025-08-10 08:08:53',1,'2025-08-10 08:05:38',11),(12,'eren','$2b$10$fLe2HTKAkKgkKgJ.HpPVguzqFTgdp6gd.bbqfuyhr1.l9OGZ1EYae','eren','eren','eren@fiu.edu.tr','Accounting','admin',1,'2025-08-05 09:44:53','2025-08-05 09:44:58',0,'2025-08-05 09:44:58',1),(13,'ali','$2b$10$2vmNR2DmYSa10qdNs05ZUeOVCfPYnxgg0L39xD.soe7ZQifYROZKW','ali','ali','ali@fiu.edu.tr','Academic','admin',1,'2025-08-05 12:41:39','2025-08-05 12:41:51',0,'2025-08-05 12:41:51',11),(14,'ayşe','$2b$10$rtlbNLxLVQEiB0VYvV6XkuLR7dff3JBxNM.VfLyPkCUIYQwl8eMR6','ayşe','ayşe','ayse@fiu.edu.tr','Accounting','admin',1,'2025-08-21 07:15:52','2025-08-21 07:16:06',0,'2025-08-21 07:16:06',11);
/*!40000 ALTER TABLE `admin_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_workload_stats`
--

DROP TABLE IF EXISTS `admin_workload_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_workload_stats` (
  `admin_id` int NOT NULL,
  `current_pending` int DEFAULT '0',
  `current_informed` int DEFAULT '0',
  `total_assigned` int DEFAULT '0',
  `last_assignment` timestamp NULL DEFAULT NULL,
  `workload_score` decimal(5,2) DEFAULT '0.00',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`admin_id`),
  CONSTRAINT `admin_workload_stats_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `admin_users` (`admin_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_workload_stats`
--

LOCK TABLES `admin_workload_stats` WRITE;
/*!40000 ALTER TABLE `admin_workload_stats` DISABLE KEYS */;
INSERT INTO `admin_workload_stats` VALUES (1,0,1,10,'2025-08-21 07:04:48',0.00,'2025-08-21 07:06:44'),(2,0,0,6,'2025-08-11 07:27:48',0.00,'2025-08-12 09:00:45'),(3,0,1,4,'2025-08-12 10:29:45',0.00,'2025-08-12 10:29:45'),(4,0,1,4,'2025-08-13 12:27:31',0.00,'2025-08-14 11:43:53'),(5,0,0,3,'2025-08-12 07:08:45',0.00,'2025-08-12 10:57:34'),(11,0,0,0,NULL,0.00,'2025-08-11 11:53:12'),(12,0,0,4,'2025-08-12 10:29:45',0.00,'2025-08-12 10:29:45'),(13,0,0,6,'2025-08-12 10:29:45',0.00,'2025-08-12 10:29:45'),(14,0,0,1,'2025-08-26 07:53:29',0.00,'2025-08-26 08:12:18');
/*!40000 ALTER TABLE `admin_workload_stats` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attachments`
--

DROP TABLE IF EXISTS `attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attachments` (
  `attachment_id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_type` varchar(100) DEFAULT NULL,
  `file_size` int DEFAULT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`attachment_id`),
  KEY `idx_attachments_request_id` (`request_id`),
  CONSTRAINT `attachments_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `guidance_requests` (`request_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attachments`
--

LOCK TABLES `attachments` WRITE;
/*!40000 ALTER TABLE `attachments` DISABLE KEYS */;
INSERT INTO `attachments` VALUES (1,1,'Ekran gÃ¶rÃ¼ntÃ¼sÃ¼ 2025-06-13 164451.png','1753629090294_516917261.png','image/png',250954,'2025-07-27 15:11:30'),(2,2,'Ekran gÃ¶rÃ¼ntÃ¼sÃ¼ 2025-07-10 130336.png','1753634045506_628562531.png','image/png',180678,'2025-07-27 16:34:05'),(3,2,'Ekran gÃ¶rÃ¼ntÃ¼sÃ¼ 2025-07-11 083947.png','1753634045511_891619176.png','image/png',62704,'2025-07-27 16:34:05'),(4,4,'Ekran gÃ¶rÃ¼ntÃ¼sÃ¼ 2024-10-26 164525.png','1753680897410_878699594.png','image/png',33160,'2025-07-28 05:34:57'),(5,7,'Ekran gÃ¶rÃ¼ntÃ¼sÃ¼ 2024-10-26 164525.png','1753703487345_619616368.png','image/png',33160,'2025-07-28 11:51:27'),(6,7,'Ekran gÃ¶rÃ¼ntÃ¼sÃ¼ 2024-12-24 180223 - Kopya.png','1753703487349_564907842.png','image/png',65094,'2025-07-28 11:51:27'),(7,7,'DELETE.png','1753703487354_482777531.png','image/png',26214,'2025-07-28 11:51:27'),(8,8,'logo.png','1754222477293_102905764.png','image/png',5271,'2025-08-03 12:01:17'),(9,8,'FIU_SGRS_Documentation.docx','1754222477296_576858716.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',28103,'2025-08-03 12:01:17'),(10,9,'fiu-logo-red.jpg','1754286452966_825150740.jpg','image/jpeg',143157,'2025-08-04 05:47:33'),(11,9,'Eren_Ozcan_Altin_Staj_CV.docx','1754286452987_833329461.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',37878,'2025-08-04 05:47:33'),(12,10,'logo.png','1754288163072_161145268.png','image/png',5271,'2025-08-04 06:16:03'),(13,11,'logo.png','1754295658488_582305892.png','image/png',5271,'2025-08-04 08:20:58'),(14,12,'Ekran gÃ¶rÃ¼ntÃ¼sÃ¼ 2025-08-03 133606.png','1754305953597_947961153.png','image/png',59479,'2025-08-04 11:12:33'),(15,21,'Ekran gÃ¶rÃ¼ntÃ¼sÃ¼ 2025-08-03 120559.png','1754396504103_842852521.png','image/png',116290,'2025-08-05 12:21:44'),(16,21,'1.5.2547.pdf','1754396504111_323068582.pdf','application/pdf',1065735,'2025-08-05 12:21:44'),(17,23,'CODE.pdf','1754396562239_132023411.pdf','application/pdf',40234,'2025-08-05 12:22:42'),(18,24,'software engineering-program.pdf','1754396577850_683726056.pdf','application/pdf',538704,'2025-08-05 12:22:57'),(19,30,'Ekran gÃ¶rÃ¼ntÃ¼sÃ¼ 2025-08-03 133606.png','1754891967094_713380049.png','image/png',59479,'2025-08-11 05:59:27'),(20,31,'Ekran gÃ¶rÃ¼ntÃ¼sÃ¼ 2025-08-03 132852.png','1754891996445_794440051.png','image/png',193842,'2025-08-11 05:59:56'),(21,39,'Ekran gÃ¶rÃ¼ntÃ¼sÃ¼ 2025-08-03 132852.png','1754977764508_301263269.png','image/png',193842,'2025-08-12 05:49:24'),(22,41,'1.5.2547.pdf','1755088051350_703417904.pdf','application/pdf',1065735,'2025-08-13 12:27:31'),(23,42,'Ekran gÃ¶rÃ¼ntÃ¼sÃ¼ 2025-08-17 163459.png','1755498217258_494172082.png','image/png',224203,'2025-08-18 06:23:37'),(24,43,'Ekran gÃ¶rÃ¼ntÃ¼sÃ¼ 2025-08-15 224201.png','1755759888444_237741169.png','image/png',258295,'2025-08-21 07:04:48'),(25,46,'WhatsApp Image 2025-08-14 at 20.38.17.jpeg','1756194809419_863094379.jpeg','image/jpeg',347835,'2025-08-26 07:53:29'),(26,46,'LoGBOOK (9).doc','1756194809430_124076222.doc','application/msword',812032,'2025-08-26 07:53:29');
/*!40000 ALTER TABLE `attachments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `department_statistics_view`
--

DROP TABLE IF EXISTS `department_statistics_view`;
/*!50001 DROP VIEW IF EXISTS `department_statistics_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `department_statistics_view` AS SELECT 
 1 AS `department`,
 1 AS `admin_count`,
 1 AS `total_requests`,
 1 AS `completed_requests`,
 1 AS `pending_requests`,
 1 AS `informed_requests`,
 1 AS `rejected_requests`,
 1 AS `total_responses`,
 1 AS `admins_with_assignments`,
 1 AS `unassigned_requests`,
 1 AS `avg_response_time`,
 1 AS `completion_rate`,
 1 AS `avg_requests_per_admin`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `document_parsing_logs`
--

DROP TABLE IF EXISTS `document_parsing_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_parsing_logs` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `upload_id` int NOT NULL,
  `parsing_stage` enum('upload','text_extraction','date_parsing','event_creation','validation','completed') NOT NULL,
  `status` enum('started','in_progress','completed','failed') NOT NULL,
  `message` text,
  `data_extracted` json DEFAULT NULL,
  `error_details` text,
  `processing_time_seconds` decimal(10,3) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_upload_stage` (`upload_id`,`parsing_stage`),
  KEY `idx_status` (`status`),
  CONSTRAINT `document_parsing_logs_ibfk_1` FOREIGN KEY (`upload_id`) REFERENCES `academic_calendar_uploads` (`upload_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=131 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `document_parsing_logs`
--

LOCK TABLES `document_parsing_logs` WRITE;
/*!40000 ALTER TABLE `document_parsing_logs` DISABLE KEYS */;
INSERT INTO `document_parsing_logs` VALUES (124,27,'upload','completed','File uploaded successfully',NULL,NULL,NULL,'2025-08-14 11:51:59'),(125,27,'text_extraction','started','Starting text extraction',NULL,NULL,NULL,'2025-08-14 11:51:59'),(126,27,'text_extraction','completed','Text extracted successfully','{\"text_length\": 5691.0}',NULL,NULL,'2025-08-14 11:52:00'),(127,27,'date_parsing','started','Starting event extraction',NULL,NULL,NULL,'2025-08-14 11:52:00'),(128,27,'date_parsing','completed','Events extracted successfully','{\"event_count\": 104.0}',NULL,NULL,'2025-08-14 11:52:00'),(129,27,'event_creation','started','Starting event creation',NULL,NULL,NULL,'2025-08-14 11:52:00'),(130,27,'completed','completed','Calendar processing completed successfully','{\"total_events\": 104.0}',NULL,NULL,'2025-08-14 11:52:00');
/*!40000 ALTER TABLE `document_parsing_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `guidance_requests`
--

DROP TABLE IF EXISTS `guidance_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `guidance_requests` (
  `request_id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `type_id` int NOT NULL,
  `content` text NOT NULL,
  `priority` enum('Low','Medium','High','Urgent') DEFAULT 'Medium',
  `status` enum('Pending','Informed','Completed','Rejected') DEFAULT 'Pending',
  `submitted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text,
  `rejected_by` int DEFAULT NULL,
  `assigned_admin_id` int DEFAULT NULL,
  `assigned_at` timestamp NULL DEFAULT NULL,
  `handled_by` int DEFAULT NULL,
  `assignment_method` enum('manual','auto','system') DEFAULT 'manual',
  PRIMARY KEY (`request_id`),
  KEY `idx_requests_student_id` (`student_id`),
  KEY `idx_requests_type_id` (`type_id`),
  KEY `idx_requests_status` (`status`),
  KEY `idx_requests_priority` (`priority`),
  KEY `idx_requests_submitted_at` (`submitted_at`),
  KEY `idx_requests_rejected_at` (`rejected_at`),
  KEY `idx_requests_rejected_by` (`rejected_by`),
  KEY `idx_assigned_admin` (`assigned_admin_id`),
  KEY `idx_handled_by` (`handled_by`),
  KEY `idx_requests_assigned_admin` (`assigned_admin_id`),
  KEY `idx_requests_assigned_at` (`assigned_at`),
  KEY `idx_requests_assignment_method` (`assignment_method`),
  CONSTRAINT `fk_assigned_admin` FOREIGN KEY (`assigned_admin_id`) REFERENCES `admin_users` (`admin_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_handled_by` FOREIGN KEY (`handled_by`) REFERENCES `admin_users` (`admin_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `guidance_requests_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE,
  CONSTRAINT `guidance_requests_ibfk_2` FOREIGN KEY (`type_id`) REFERENCES `request_types` (`type_id`) ON DELETE CASCADE,
  CONSTRAINT `guidance_requests_ibfk_3` FOREIGN KEY (`rejected_by`) REFERENCES `admin_users` (`admin_id`) ON DELETE SET NULL,
  CONSTRAINT `guidance_requests_ibfk_4` FOREIGN KEY (`assigned_admin_id`) REFERENCES `admin_users` (`admin_id`),
  CONSTRAINT `guidance_requests_ibfk_5` FOREIGN KEY (`handled_by`) REFERENCES `admin_users` (`admin_id`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `guidance_requests`
--

LOCK TABLES `guidance_requests` WRITE;
/*!40000 ALTER TABLE `guidance_requests` DISABLE KEYS */;
INSERT INTO `guidance_requests` VALUES (1,1,2,'acil deneme','Urgent','Completed','2025-07-27 15:11:29','2025-08-10 07:24:10','2025-08-03 07:46:56',NULL,NULL,NULL,1,'2025-07-30 12:15:32',1,'system'),(2,1,1,'deneme 2','High','Rejected','2025-07-27 16:34:04','2025-08-10 07:24:10',NULL,'2025-08-03 10:35:39','deneme 123 1231 1234 214',1,1,'2025-08-03 10:35:39',1,'system'),(3,1,1,'agfeag','Low','Completed','2025-07-27 18:40:25','2025-08-10 07:25:31','2025-07-28 08:06:50',NULL,NULL,NULL,1,'2025-07-28 08:06:50',1,'system'),(4,1,1,'deneme 4','Medium','Rejected','2025-07-28 05:34:56','2025-08-10 07:24:10',NULL,'2025-08-04 07:52:57','aaaaaaaaaaaaaa',1,1,'2025-08-04 07:52:57',1,'system'),(5,1,3,'deneme 5','Urgent','Completed','2025-07-28 05:48:33','2025-08-10 07:25:31','2025-07-28 08:06:53',NULL,NULL,NULL,1,'2025-07-28 08:06:53',1,'system'),(6,1,3,'deneme 6','Medium','Rejected','2025-07-28 10:18:56','2025-08-10 07:24:10',NULL,'2025-08-03 10:56:42','Student not eligible for this service',1,1,'2025-08-03 10:56:42',1,'system'),(7,1,9,'aaaaaaaaaaa','Medium','Completed','2025-07-28 11:51:26','2025-08-10 07:25:31','2025-07-28 12:19:23',NULL,NULL,NULL,2,'2025-07-28 12:19:23',2,'system'),(8,1,24,'deneme dorm','Urgent','Completed','2025-08-03 12:01:17','2025-08-10 07:25:31','2025-08-05 09:59:08',NULL,NULL,NULL,4,'2025-08-05 09:59:08',4,'system'),(9,1,1,'deneme 13 ','Medium','Rejected','2025-08-04 05:47:32','2025-08-10 07:24:10',NULL,'2025-08-04 06:44:52','RECEJT DENEME 12345566',1,1,'2025-08-04 06:44:52',1,'system'),(10,1,3,'EREEENNNNNN','Medium','Rejected','2025-08-04 06:16:03','2025-08-10 07:24:10',NULL,'2025-08-04 06:17:14','Application deadline has passed',1,1,'2025-08-04 06:16:49',1,'system'),(11,1,8,'acedemic deneme ','Urgent','Completed','2025-08-04 08:20:58','2025-08-10 07:25:31','2025-08-04 11:17:24',NULL,NULL,NULL,2,'2025-08-04 11:17:24',2,'system'),(12,1,10,'ı want to withdraw cmp215 ','Urgent','Completed','2025-08-04 11:12:33','2025-08-10 07:25:31','2025-08-04 11:18:28',NULL,NULL,NULL,2,'2025-08-10 07:24:10',2,'system'),(13,1,1,'talep123123','Medium','Completed','2025-08-05 09:46:51','2025-08-10 07:24:10','2025-08-05 09:49:07',NULL,NULL,NULL,12,'2025-08-05 09:49:01',12,'system'),(14,1,3,'talepdeneme','High','Completed','2025-08-05 09:47:19','2025-08-10 07:24:10','2025-08-05 09:49:07',NULL,NULL,NULL,12,'2025-08-05 09:48:43',12,'system'),(15,1,13,'stat deneme','Medium','Completed','2025-08-05 11:08:50','2025-08-10 07:25:31','2025-08-05 11:14:44',NULL,NULL,NULL,3,'2025-08-05 11:14:44',3,'system'),(16,1,21,'aedgwsregyhr','Urgent','Completed','2025-08-05 11:09:44','2025-08-10 07:24:10','2025-08-05 11:13:21',NULL,NULL,NULL,4,'2025-08-05 11:12:46',4,'system'),(17,1,9,'asfdsafag','Medium','Completed','2025-08-05 11:10:15','2025-08-10 08:01:40','2025-08-10 08:01:40',NULL,NULL,NULL,2,'2025-08-05 11:15:31',2,'system'),(18,1,30,'yyyyyyyyyyyyyyy','High','Completed','2025-08-05 11:10:53','2025-08-11 08:27:25','2025-08-11 08:27:25',NULL,NULL,NULL,5,'2025-08-05 11:13:49',5,'system'),(19,1,18,'rrrrrrrrrrrrrr','Medium','Informed','2025-08-05 11:11:17','2025-08-10 07:24:10',NULL,NULL,NULL,NULL,3,'2025-08-05 11:14:42',3,'system'),(20,1,24,'ryyyrewayary','Medium','Rejected','2025-08-05 11:11:30','2025-08-11 08:26:28',NULL,'2025-08-11 08:26:28','Missing required documents',4,4,'2025-08-05 11:12:56',4,'system'),(21,1,17,'asfgerghrh','Urgent','Rejected','2025-08-05 12:21:44','2025-08-11 08:29:31',NULL,'2025-08-11 08:29:31','Missing required documents',3,3,'2025-08-10 07:25:45',NULL,'system'),(22,1,12,'aaaaaaaaaaaaaaaaaaa','Medium','Completed','2025-08-05 12:22:05','2025-08-10 08:02:02','2025-08-10 08:02:02',NULL,NULL,NULL,13,'2025-08-10 07:25:45',NULL,'system'),(23,1,2,'afawegaeg','Medium','Rejected','2025-08-05 12:22:42','2025-08-11 08:24:57',NULL,'2025-08-11 08:24:57','Request submitted to wrong department',1,1,'2025-08-10 07:25:45',NULL,'system'),(24,1,7,'afgaeeeeeeeeeeeeeeeeeeeee','Medium','Rejected','2025-08-05 12:22:57','2025-08-10 08:01:49',NULL,'2025-08-10 08:01:49','Request exceeds department policy limits',13,13,'2025-08-10 07:25:45',NULL,'system'),(25,2,29,'MERHABA BU BİR DENEME','Urgent','Completed','2025-08-11 05:54:51','2025-08-12 10:29:45','2025-08-11 08:27:06',NULL,NULL,NULL,5,'2025-08-12 10:29:45',NULL,'manual'),(26,2,18,'24 SAAT DENEMESİ','High','Completed','2025-08-11 05:55:29','2025-08-12 10:29:45','2025-08-11 08:29:27',NULL,NULL,NULL,3,'2025-08-12 10:29:45',NULL,'manual'),(27,2,12,'DENEME 3 DENEME','Medium','Completed','2025-08-11 05:55:56','2025-08-12 10:29:45','2025-08-11 07:27:31',NULL,NULL,NULL,13,'2025-08-12 10:29:45',NULL,'manual'),(28,2,1,'EREN ÖZCAN ALTIN','High','Completed','2025-08-11 05:56:33','2025-08-12 10:29:45','2025-08-11 08:24:50',NULL,NULL,NULL,12,'2025-08-12 10:29:45',NULL,'manual'),(29,2,8,'DENEME','Medium','Completed','2025-08-11 05:58:41','2025-08-12 10:29:45','2025-08-11 07:28:39',NULL,NULL,NULL,13,'2025-08-12 10:29:45',NULL,'manual'),(30,2,2,'AAAAAAAAAAAAAAAAAA','Medium','Completed','2025-08-11 05:59:27','2025-08-12 10:29:45','2025-08-11 08:24:58',NULL,NULL,NULL,12,'2025-08-12 10:29:45',NULL,'manual'),(31,2,10,'RRRRRRRRRRRRRRRRRR','Medium','Completed','2025-08-11 05:59:56','2025-08-12 09:00:45','2025-08-12 09:00:45',NULL,NULL,NULL,2,'2025-08-11 07:27:48',NULL,'auto'),(32,2,6,'HHHHHHHHHHHHHHHHHHHHHHH','Medium','Rejected','2025-08-11 06:00:11','2025-08-11 11:52:32',NULL,'2025-08-11 07:27:38','Incomplete information provided',2,2,'2025-08-11 07:27:38',NULL,'auto'),(33,2,9,'YYYYYYYYYYYYYYYYYYYYY','Medium','Rejected','2025-08-11 06:00:27','2025-08-11 11:52:32',NULL,'2025-08-11 07:28:38','Request does not meet department criteria',13,13,'2025-08-11 07:28:38',NULL,'auto'),(39,1,12,'de11111111111de','Medium','Completed','2025-08-12 05:49:24','2025-08-12 08:59:58','2025-08-12 08:59:58',NULL,NULL,NULL,13,'2025-08-12 05:49:24',NULL,'auto'),(40,2,29,'denme 5555','Urgent','Completed','2025-08-12 07:08:45','2025-08-12 10:57:34','2025-08-12 10:57:34',NULL,NULL,NULL,5,'2025-08-12 07:08:45',NULL,'auto'),(41,1,22,'ı want key replacement','Medium','Informed','2025-08-13 12:27:31','2025-08-14 11:43:53',NULL,NULL,NULL,NULL,4,'2025-08-13 12:27:31',NULL,'auto'),(42,1,6,'ı have course registration problem','Urgent','Pending','2025-08-18 06:23:37','2025-08-18 06:23:37',NULL,NULL,NULL,NULL,2,'2025-08-18 06:23:37',NULL,'auto'),(43,2,5,'refun request','High','Informed','2025-08-21 07:04:48','2025-08-21 07:06:44',NULL,NULL,NULL,NULL,1,'2025-08-21 07:04:48',NULL,'auto'),(44,2,17,'notification deneme','Urgent','Pending','2025-08-22 12:10:41','2025-08-22 12:10:41',NULL,NULL,NULL,NULL,3,'2025-08-22 12:10:41',NULL,'auto'),(45,1,28,'deneme notification','Urgent','Pending','2025-08-22 12:21:36','2025-08-22 12:21:36',NULL,NULL,NULL,NULL,5,'2025-08-22 12:21:36',NULL,'auto'),(46,2,2,'üüüüüüüüüüüüüüüüüüüüüüüüüüüüüüüüüüüü','Medium','Rejected','2025-08-26 07:53:29','2025-08-26 08:12:18',NULL,'2025-08-26 08:12:18','Incomplete information provided',1,14,'2025-08-26 07:53:29',NULL,'auto');
/*!40000 ALTER TABLE `guidance_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `holiday_patterns`
--

DROP TABLE IF EXISTS `holiday_patterns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `holiday_patterns` (
  `pattern_id` int NOT NULL AUTO_INCREMENT,
  `pattern_name` varchar(100) NOT NULL,
  `pattern_name_tr` varchar(100) NOT NULL,
  `typical_duration_days` int NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`pattern_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `holiday_patterns`
--

LOCK TABLES `holiday_patterns` WRITE;
/*!40000 ALTER TABLE `holiday_patterns` DISABLE KEYS */;
INSERT INTO `holiday_patterns` VALUES (1,'eid_al_fitr','Ramazan Bayramı',3,'Eid al-Fitr celebration period','2025-08-13 12:20:14'),(2,'eid_al_adha','Kurban Bayramı',4,'Eid al-Adha celebration period','2025-08-13 12:20:14'),(3,'semester_break','Dönem Arası',7,'Mid-semester break period','2025-08-13 18:29:53'),(4,'exam_period','Sınav Dönemi',14,'Examination period - restricted activity','2025-08-13 18:29:53'),(5,'orientation','Oryantasyon',3,'Student orientation period','2025-08-13 18:29:53'),(6,'registration','Kayıt Dönemi',5,'Student registration period','2025-08-13 18:29:53');
/*!40000 ALTER TABLE `holiday_patterns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_states`
--

DROP TABLE IF EXISTS `notification_states`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_states` (
  `id` int NOT NULL AUTO_INCREMENT,
  `admin_id` int NOT NULL,
  `notification_id` varchar(255) NOT NULL,
  `state` enum('read','dismissed') NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_admin_notification` (`admin_id`,`notification_id`),
  KEY `admin_id` (`admin_id`),
  KEY `notification_id` (`notification_id`),
  CONSTRAINT `notification_states_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `admin_users` (`admin_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_states`
--

LOCK TABLES `notification_states` WRITE;
/*!40000 ALTER TABLE `notification_states` DISABLE KEYS */;
/*!40000 ALTER TABLE `notification_states` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `user_type` enum('student','admin') DEFAULT 'student',
  `type` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text,
  `related_request_id` int DEFAULT NULL,
  `priority` varchar(20) DEFAULT 'Medium',
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `related_request_id` (`related_request_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`related_request_id`) REFERENCES `guidance_requests` (`request_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permission_group_mappings`
--

DROP TABLE IF EXISTS `permission_group_mappings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permission_group_mappings` (
  `group_id` int NOT NULL,
  `permission_id` int NOT NULL,
  PRIMARY KEY (`group_id`,`permission_id`),
  KEY `permission_id` (`permission_id`),
  CONSTRAINT `permission_group_mappings_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `permission_groups` (`group_id`) ON DELETE CASCADE,
  CONSTRAINT `permission_group_mappings_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`permission_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permission_group_mappings`
--

LOCK TABLES `permission_group_mappings` WRITE;
/*!40000 ALTER TABLE `permission_group_mappings` DISABLE KEYS */;
INSERT INTO `permission_group_mappings` VALUES (1,2),(1,4),(1,5),(2,7),(1,10),(2,11),(2,12),(2,13),(6,46),(6,47),(6,48),(6,49),(2,50),(2,51),(2,52);
/*!40000 ALTER TABLE `permission_group_mappings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permission_groups`
--

DROP TABLE IF EXISTS `permission_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permission_groups` (
  `group_id` int NOT NULL AUTO_INCREMENT,
  `group_name` varchar(50) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`group_id`),
  UNIQUE KEY `group_name` (`group_name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permission_groups`
--

LOCK TABLES `permission_groups` WRITE;
/*!40000 ALTER TABLE `permission_groups` DISABLE KEYS */;
INSERT INTO `permission_groups` VALUES (1,'basic_request_management','Basic Request Management','Core permissions for handling requests','2025-07-29 05:57:43'),(2,'advanced_request_management','Advanced Request Management','Extended permissions for request processing','2025-07-29 05:57:43'),(3,'user_administration','User Administration','Permissions for managing users and roles','2025-07-29 05:57:43'),(4,'system_administration','System Administration','High-level system management permissions','2025-07-29 05:57:43'),(5,'analytics_reporting','Analytics & Reporting','Permissions for viewing and generating reports','2025-07-29 05:57:43'),(6,'file_management','File Management','Permissions for handling file uploads and downloads','2025-07-29 05:57:43');
/*!40000 ALTER TABLE `permission_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `permission_id` int NOT NULL AUTO_INCREMENT,
  `permission_name` varchar(100) NOT NULL,
  `display_name` varchar(150) NOT NULL,
  `description` text,
  `resource` varchar(50) NOT NULL,
  `action` varchar(50) NOT NULL,
  `is_system_permission` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`permission_id`),
  UNIQUE KEY `permission_name` (`permission_name`),
  KEY `idx_permissions_resource` (`resource`),
  KEY `idx_permissions_action` (`action`),
  KEY `idx_permissions_resource_action` (`resource`,`action`)
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'requests.view_all','View All Requests','Can view requests from all departments','requests','view_all',1,'2025-07-29 05:55:36'),(2,'requests.view_department','View Department Requests','Can view requests from own department','requests','view_department',1,'2025-07-29 05:55:36'),(3,'requests.view_assigned','View Assigned Requests','Can view only assigned requests','requests','view_assigned',1,'2025-07-29 05:55:36'),(4,'requests.create','Create Requests','Can create new requests','requests','create',1,'2025-07-29 05:55:36'),(5,'requests.update_status','Update Request Status','Can change request status','requests','update_status',1,'2025-07-29 05:55:36'),(6,'requests.update_priority','Update Request Priority','Can change request priority','requests','update_priority',1,'2025-07-29 05:55:36'),(7,'requests.assign','Assign Requests','Can assign requests to other users','requests','assign',1,'2025-07-29 05:55:36'),(8,'requests.delete','Delete Requests','Can delete requests','requests','delete',1,'2025-07-29 05:55:36'),(9,'requests.export','Export Requests','Can export request data','requests','export',1,'2025-07-29 05:55:36'),(10,'responses.create','Create Responses','Can add responses to requests','responses','create',1,'2025-07-29 05:55:36'),(11,'responses.update','Update Responses','Can edit existing responses','responses','update',1,'2025-07-29 05:55:36'),(12,'responses.delete','Delete Responses','Can delete responses','responses','delete',1,'2025-07-29 05:55:36'),(13,'responses.view_internal','View Internal Responses','Can view internal admin responses','responses','view_internal',1,'2025-07-29 05:55:36'),(14,'users.view','View Users','Can view user profiles','users','view',1,'2025-07-29 05:55:36'),(15,'users.create','Create Users','Can create new admin users','users','create',1,'2025-07-29 05:55:36'),(16,'users.update','Update Users','Can edit user profiles','users','update',1,'2025-07-29 05:55:36'),(17,'users.delete','Delete Users','Can delete admin users','users','delete',1,'2025-07-29 05:55:36'),(18,'users.manage_roles','Manage User Roles','Can assign/remove roles from users','users','manage_roles',1,'2025-07-29 05:55:36'),(19,'users.reset_password','Reset User Passwords','Can reset user passwords','users','reset_password',1,'2025-07-29 05:55:36'),(20,'analytics.view_department','View Department Analytics','Can view own department analytics','analytics','view_department',1,'2025-07-29 05:55:36'),(21,'analytics.view_system','View System Analytics','Can view system-wide analytics','analytics','view_system',1,'2025-07-29 05:55:36'),(22,'analytics.export','Export Analytics','Can export analytics data','analytics','export',1,'2025-07-29 05:55:36'),(23,'settings.view','View Settings','Can view system settings','settings','view',1,'2025-07-29 05:55:36'),(24,'settings.update','Update Settings','Can modify system settings','settings','update',1,'2025-07-29 05:55:36'),(25,'settings.manage_request_types','Manage Request Types','Can create/edit/delete request types','settings','manage_request_types',1,'2025-07-29 05:55:36'),(26,'notifications.send','Send Notifications','Can send notifications to users','notifications','send',1,'2025-07-29 05:55:36'),(27,'notifications.manage','Manage Notifications','Can manage notification settings','notifications','manage',1,'2025-07-29 05:55:36'),(28,'system.backup','System Backup','Can create system backups','system','backup',1,'2025-07-29 05:55:36'),(29,'system.maintenance','System Maintenance','Can put system in maintenance mode','system','maintenance',1,'2025-07-29 05:55:36'),(30,'system.logs','View System Logs','Can view system logs','system','logs',1,'2025-07-29 05:55:36'),(31,'accounting.manage_payments','Manage Payments','Can process and manage payment requests','accounting','manage_payments',0,'2025-07-29 05:57:43'),(32,'accounting.view_financial_reports','View Financial Reports','Can access financial reports and analytics','accounting','view_financial_reports',0,'2025-07-29 05:57:43'),(33,'accounting.process_refunds','Process Refunds','Can initiate and process refund requests','accounting','process_refunds',0,'2025-07-29 05:57:43'),(34,'academic.manage_transcripts','Manage Transcripts','Can process transcript requests','academic','manage_transcripts',0,'2025-07-29 05:57:43'),(35,'academic.process_grade_appeals','Process Grade Appeals','Can handle grade appeal processes','academic','process_grade_appeals',0,'2025-07-29 05:57:43'),(36,'academic.manage_enrollment','Manage Enrollment','Can handle course registration issues','academic','manage_enrollment',0,'2025-07-29 05:57:43'),(37,'dormitory.assign_rooms','Assign Rooms','Can assign and manage room assignments','dormitory','assign_rooms',0,'2025-07-29 05:57:43'),(38,'dormitory.handle_maintenance','Handle Maintenance','Can process maintenance requests','dormitory','handle_maintenance',0,'2025-07-29 05:57:43'),(39,'dormitory.manage_contracts','Manage Contracts','Can modify dormitory contracts','dormitory','manage_contracts',0,'2025-07-29 05:57:43'),(40,'student_affairs.handle_disciplinary','Handle Disciplinary Issues','Can process disciplinary matters','student_affairs','handle_disciplinary',0,'2025-07-29 05:57:43'),(41,'student_affairs.manage_organizations','Manage Student Organizations','Can oversee student organization requests','student_affairs','manage_organizations',0,'2025-07-29 05:57:43'),(42,'student_affairs.issue_certificates','Issue Certificates','Can issue student certificates and documents','student_affairs','issue_certificates',0,'2025-07-29 05:57:43'),(43,'campus_services.manage_it_support','Manage IT Support','Can handle IT support requests','campus_services','manage_it_support',0,'2025-07-29 05:57:43'),(44,'campus_services.manage_facilities','Manage Facilities','Can handle facility booking and issues','campus_services','manage_facilities',0,'2025-07-29 05:57:43'),(45,'campus_services.handle_parking','Handle Parking','Can process parking permit requests','campus_services','handle_parking',0,'2025-07-29 05:57:43'),(46,'files.upload','Upload Files','Can upload files to requests','files','upload',1,'2025-07-29 05:57:43'),(47,'files.download','Download Files','Can download attached files','files','download',1,'2025-07-29 05:57:43'),(48,'files.delete','Delete Files','Can delete attached files','files','delete',1,'2025-07-29 05:57:43'),(49,'files.view_metadata','View File Metadata','Can view file information and metadata','files','view_metadata',1,'2025-07-29 05:57:43'),(50,'requests.bulk_update','Bulk Update Requests','Can update multiple requests at once','requests','bulk_update',1,'2025-07-29 05:57:43'),(51,'requests.view_history','View Request History','Can view request audit trail and history','requests','view_history',1,'2025-07-29 05:57:43'),(52,'requests.escalate','Escalate Requests','Can escalate requests to higher authorities','requests','escalate',1,'2025-07-29 05:57:43'),(53,'reports.create_custom','Create Custom Reports','Can create custom report templates','reports','create_custom',1,'2025-07-29 05:57:43'),(54,'reports.schedule','Schedule Reports','Can schedule automated reports','reports','schedule',1,'2025-07-29 05:57:43'),(55,'reports.view_advanced','View Advanced Reports','Can access advanced analytics and reports','reports','view_advanced',1,'2025-07-29 05:57:43');
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `request_rejections`
--

DROP TABLE IF EXISTS `request_rejections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `request_rejections` (
  `rejection_id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `reason` text NOT NULL,
  `additional_info` text,
  `rejected_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `rejected_by_admin` int DEFAULT NULL,
  PRIMARY KEY (`rejection_id`),
  KEY `request_id` (`request_id`),
  KEY `rejected_by_admin` (`rejected_by_admin`),
  CONSTRAINT `request_rejections_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `guidance_requests` (`request_id`),
  CONSTRAINT `request_rejections_ibfk_2` FOREIGN KEY (`rejected_by_admin`) REFERENCES `admin_users` (`admin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `request_rejections`
--

LOCK TABLES `request_rejections` WRITE;
/*!40000 ALTER TABLE `request_rejections` DISABLE KEYS */;
/*!40000 ALTER TABLE `request_rejections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `request_types`
--

DROP TABLE IF EXISTS `request_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `request_types` (
  `type_id` int NOT NULL AUTO_INCREMENT,
  `category` varchar(100) NOT NULL,
  `type_name` varchar(255) NOT NULL,
  `description_en` text,
  `is_document_required` tinyint(1) DEFAULT '0',
  `is_disabled` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`type_id`),
  KEY `idx_request_types_category` (`category`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `request_types`
--

LOCK TABLES `request_types` WRITE;
/*!40000 ALTER TABLE `request_types` DISABLE KEYS */;
INSERT INTO `request_types` VALUES (1,'Accounting','Payment Issues','Problems with tuition payments, refunds, or billing',0,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(2,'Accounting','Financial Aid Support','Assistance with scholarships, grants, and financial aid applications',1,0,'2025-07-27 13:15:07','2025-08-21 07:07:51'),(3,'Accounting','Receipt Requests','Request for payment receipts and financial documents',0,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(4,'Accounting','Installment Plan Setup','Setting up payment plans for tuition fees',0,0,'2025-07-27 13:15:07','2025-08-14 09:41:36'),(5,'Accounting','Refund Requests','Request for tuition or fee refunds',1,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(6,'Academic','Course Registration Problems','Issues with course enrollment, prerequisites, or scheduling conflicts',0,0,'2025-07-27 13:15:07','2025-08-20 09:08:50'),(7,'Academic','Grade Appeals','Formal appeals for grade reviews and corrections',1,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(8,'Academic','Transcript Requests','Official and unofficial transcript requests',1,0,'2025-07-27 13:15:07','2025-08-14 09:41:36'),(9,'Academic','Academic Probation Support','Guidance for students on academic probation',1,0,'2025-07-27 13:15:07','2025-08-21 09:23:10'),(10,'Academic','Course Withdrawal','Requests for course or semester withdrawal',0,0,'2025-07-27 13:15:07','2025-08-14 09:41:36'),(11,'Academic','Credit Transfer Evaluation','Evaluation of transfer credits from other institutions',1,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(12,'Academic','Graduation Requirements Check','Verification of graduation requirements completion',0,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(13,'Student Affairs','Student ID Issues','Problems with student ID cards, replacements, or updates',0,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(14,'Student Affairs','Campus Event Participation','Registration and information about campus events and activities',0,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(15,'Student Affairs','Student Organization Support','Assistance with student clubs and organization matters',0,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(16,'Student Affairs','Disciplinary Appeals','Appeals for disciplinary actions and academic misconduct',1,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(17,'Student Affairs','Emergency Support','Emergency financial or personal support requests',0,0,'2025-07-27 13:15:07','2025-08-14 09:41:36'),(18,'Student Affairs','Mental Health Resources','Access to counseling and mental health support services',0,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(19,'Dormitory','Room Assignment Issues','Problems with dormitory room assignments or changes',0,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(20,'Dormitory','Maintenance Requests','Reporting maintenance issues in dormitory facilities',0,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(21,'Dormitory','Roommate Conflicts','Mediation and support for roommate-related issues',0,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(22,'Dormitory','Key Replacement','Replacement of lost or damaged dormitory keys',0,0,'2025-07-27 13:15:07','2025-08-18 07:24:47'),(23,'Dormitory','Contract Termination','Early termination of dormitory housing contracts',1,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(24,'Dormitory','Facility Complaints','Complaints about dormitory facilities and services',0,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(25,'Campus Services','IT Support Requests','Computer, network, and technology-related support',0,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(26,'Campus Services','Library Access Issues','Problems with library access, resources, or services',0,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(27,'Campus Services','Parking Permits','Applications and issues related to campus parking permits',0,0,'2025-07-27 13:15:07','2025-08-14 09:41:36'),(28,'Campus Services','Campus Security Concerns','Reporting security incidents or safety concerns',0,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(29,'Campus Services','Facility Booking','Reservations for campus facilities and meeting rooms',0,0,'2025-07-27 13:15:07','2025-07-27 13:15:07'),(30,'Campus Services','Lost and Found','Reporting or claiming lost items on campus',0,0,'2025-07-27 13:15:07','2025-07-27 13:15:07');
/*!40000 ALTER TABLE `request_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `role_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `granted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `granted_by` int DEFAULT NULL,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `permission_id` (`permission_id`),
  KEY `granted_by` (`granted_by`),
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE CASCADE,
  CONSTRAINT `role_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`permission_id`) ON DELETE CASCADE,
  CONSTRAINT `role_permissions_ibfk_3` FOREIGN KEY (`granted_by`) REFERENCES `admin_users` (`admin_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permissions`
--

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES (1,1,'2025-07-29 05:55:36',NULL),(1,2,'2025-07-29 05:55:36',NULL),(1,3,'2025-07-29 05:55:36',NULL),(1,4,'2025-07-29 05:55:36',NULL),(1,5,'2025-07-29 05:55:36',NULL),(1,6,'2025-07-29 05:55:36',NULL),(1,7,'2025-07-29 05:55:36',NULL),(1,8,'2025-07-29 05:55:36',NULL),(1,9,'2025-07-29 05:55:36',NULL),(1,10,'2025-07-29 05:55:36',NULL),(1,11,'2025-07-29 05:55:36',NULL),(1,12,'2025-07-29 05:55:36',NULL),(1,13,'2025-07-29 05:55:36',NULL),(1,14,'2025-07-29 05:55:36',NULL),(1,15,'2025-07-29 05:55:36',NULL),(1,16,'2025-07-29 05:55:36',NULL),(1,17,'2025-07-29 05:55:36',NULL),(1,18,'2025-07-29 05:55:36',NULL),(1,19,'2025-07-29 05:55:36',NULL),(1,20,'2025-07-29 05:55:36',NULL),(1,21,'2025-07-29 05:55:36',NULL),(1,22,'2025-07-29 05:55:36',NULL),(1,23,'2025-07-29 05:55:36',NULL),(1,24,'2025-07-29 05:55:36',NULL),(1,25,'2025-07-29 05:55:36',NULL),(1,26,'2025-07-29 05:55:36',NULL),(1,27,'2025-07-29 05:55:36',NULL),(1,28,'2025-07-29 05:55:36',NULL),(1,29,'2025-07-29 05:55:36',NULL),(1,30,'2025-07-29 05:55:36',NULL),(2,2,'2025-08-05 05:41:47',11),(2,4,'2025-08-05 05:41:47',11),(2,5,'2025-08-05 05:41:47',11),(2,6,'2025-08-05 05:41:47',11),(2,7,'2025-08-05 05:41:47',11),(2,9,'2025-08-05 05:41:47',11),(2,10,'2025-08-05 05:41:47',11),(2,11,'2025-08-05 05:41:47',11),(2,12,'2025-08-05 05:41:47',11),(2,13,'2025-08-05 05:41:47',11),(2,14,'2025-08-05 05:41:47',11),(2,15,'2025-08-05 05:41:47',11),(2,16,'2025-08-05 05:41:47',11),(2,17,'2025-08-05 05:41:47',11),(2,18,'2025-08-05 05:41:47',11),(2,19,'2025-08-05 05:41:47',11),(2,20,'2025-08-05 05:41:47',11),(2,21,'2025-08-05 05:41:47',11),(2,22,'2025-08-05 05:41:47',11),(2,23,'2025-08-05 05:41:47',11),(2,24,'2025-08-05 05:41:47',11),(2,25,'2025-08-05 05:41:47',11),(2,26,'2025-08-05 05:41:47',11),(2,27,'2025-08-05 05:41:47',11),(2,31,'2025-08-05 05:41:47',11),(2,32,'2025-08-05 05:41:47',11),(2,33,'2025-08-05 05:41:47',11),(2,34,'2025-08-05 05:41:47',11),(2,35,'2025-08-05 05:41:47',11),(2,36,'2025-08-05 05:41:47',11),(2,37,'2025-08-05 05:41:47',11),(2,38,'2025-08-05 05:41:47',11),(2,39,'2025-08-05 05:41:47',11),(2,40,'2025-08-05 05:41:47',11),(2,41,'2025-08-05 05:41:47',11),(2,42,'2025-08-05 05:41:47',11),(2,43,'2025-08-05 05:41:47',11),(2,44,'2025-08-05 05:41:47',11),(2,45,'2025-08-05 05:41:47',11),(2,46,'2025-08-05 05:41:47',11),(2,47,'2025-08-05 05:41:47',11),(2,48,'2025-08-05 05:41:47',11),(2,49,'2025-08-05 05:41:47',11),(2,53,'2025-08-05 05:41:47',11),(2,54,'2025-08-05 05:41:47',11),(2,55,'2025-08-05 05:41:47',11),(3,2,'2025-07-29 05:55:36',NULL),(3,4,'2025-07-29 05:55:36',NULL),(3,5,'2025-07-29 05:55:36',NULL),(3,10,'2025-07-29 05:55:36',NULL),(3,11,'2025-07-29 05:55:36',NULL),(3,20,'2025-07-29 05:55:36',NULL),(3,23,'2025-07-29 05:55:36',NULL),(3,26,'2025-07-29 05:55:36',NULL),(3,46,'2025-07-29 05:57:43',NULL),(3,47,'2025-07-29 05:57:43',NULL),(3,49,'2025-07-29 05:57:43',NULL),(4,2,'2025-07-29 05:55:36',NULL),(4,20,'2025-07-29 05:55:36',NULL),(4,23,'2025-07-29 05:55:36',NULL),(5,3,'2025-07-29 05:55:36',NULL),(5,5,'2025-07-29 05:55:36',NULL),(5,10,'2025-07-29 05:55:36',NULL),(5,23,'2025-07-29 05:55:36',NULL),(6,2,'2025-07-29 05:57:43',NULL),(6,4,'2025-07-29 05:57:43',NULL),(6,5,'2025-07-29 05:57:43',NULL),(6,10,'2025-07-29 05:57:43',NULL),(6,11,'2025-07-29 05:57:43',NULL),(6,20,'2025-07-29 05:57:43',NULL),(6,31,'2025-07-29 05:57:43',NULL),(6,32,'2025-07-29 05:57:43',NULL),(6,33,'2025-07-29 05:57:43',NULL),(6,46,'2025-07-29 05:57:43',NULL),(6,47,'2025-07-29 05:57:43',NULL),(6,49,'2025-07-29 05:57:43',NULL),(7,2,'2025-07-29 05:57:43',NULL),(7,4,'2025-07-29 05:57:43',NULL),(7,5,'2025-07-29 05:57:43',NULL),(7,7,'2025-07-29 05:57:43',NULL),(7,10,'2025-07-29 05:57:43',NULL),(7,11,'2025-07-29 05:57:43',NULL),(7,13,'2025-07-29 05:57:43',NULL),(7,20,'2025-07-29 05:57:43',NULL),(7,22,'2025-07-29 05:57:43',NULL),(7,34,'2025-07-29 05:57:43',NULL),(7,35,'2025-07-29 05:57:43',NULL),(7,36,'2025-07-29 05:57:43',NULL),(7,46,'2025-07-29 05:57:43',NULL),(7,47,'2025-07-29 05:57:43',NULL),(7,48,'2025-07-29 05:57:43',NULL),(7,49,'2025-07-29 05:57:43',NULL),(8,2,'2025-07-29 05:57:43',NULL),(8,4,'2025-07-29 05:57:43',NULL),(8,5,'2025-07-29 05:57:43',NULL),(8,7,'2025-07-29 05:57:43',NULL),(8,10,'2025-07-29 05:57:43',NULL),(8,11,'2025-07-29 05:57:43',NULL),(8,20,'2025-07-29 05:57:43',NULL),(8,37,'2025-07-29 05:57:43',NULL),(8,38,'2025-07-29 05:57:43',NULL),(8,39,'2025-07-29 05:57:43',NULL),(8,46,'2025-07-29 05:57:43',NULL),(8,47,'2025-07-29 05:57:43',NULL),(8,49,'2025-07-29 05:57:43',NULL),(9,2,'2025-07-29 05:57:43',NULL),(9,4,'2025-07-29 05:57:43',NULL),(9,5,'2025-07-29 05:57:43',NULL),(9,10,'2025-07-29 05:57:43',NULL),(9,11,'2025-07-29 05:57:43',NULL),(9,13,'2025-07-29 05:57:43',NULL),(9,20,'2025-07-29 05:57:43',NULL),(9,40,'2025-07-29 05:57:43',NULL),(9,41,'2025-07-29 05:57:43',NULL),(9,42,'2025-07-29 05:57:43',NULL),(9,46,'2025-07-29 05:57:43',NULL),(9,47,'2025-07-29 05:57:43',NULL),(9,49,'2025-07-29 05:57:43',NULL),(9,52,'2025-07-29 05:57:43',NULL),(10,2,'2025-07-29 05:57:43',NULL),(10,4,'2025-07-29 05:57:43',NULL),(10,5,'2025-07-29 05:57:43',NULL),(10,7,'2025-07-29 05:57:43',NULL),(10,10,'2025-07-29 05:57:43',NULL),(10,11,'2025-07-29 05:57:43',NULL),(10,13,'2025-07-29 05:57:43',NULL),(10,20,'2025-07-29 05:57:43',NULL),(10,22,'2025-07-29 05:57:43',NULL),(10,43,'2025-07-29 05:57:43',NULL),(10,44,'2025-07-29 05:57:43',NULL),(10,45,'2025-07-29 05:57:43',NULL),(10,46,'2025-07-29 05:57:43',NULL),(10,47,'2025-07-29 05:57:43',NULL),(10,48,'2025-07-29 05:57:43',NULL),(10,49,'2025-07-29 05:57:43',NULL),(11,3,'2025-07-29 05:57:43',NULL),(11,23,'2025-07-29 05:57:43',NULL);
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(50) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `description` text,
  `is_system_role` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `role_name` (`role_name`),
  KEY `idx_roles_active` (`is_active`),
  KEY `idx_roles_system` (`is_system_role`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'super_admin','Super Administrator','Full system access and management capabilities',1,1,'2025-07-29 05:55:36','2025-07-29 05:55:36'),(2,'department_admin','Department Administrator','Full access to own department with user management',1,1,'2025-07-29 05:55:36','2025-07-29 05:55:36'),(3,'department_staff','Department Staff','Standard department access for processing requests',1,1,'2025-07-29 05:55:36','2025-07-29 05:55:36'),(4,'read_only_admin','Read Only Administrator','View-only access to department data',1,1,'2025-07-29 05:55:36','2025-07-29 05:55:36'),(5,'trainee_admin','Trainee Administrator','Limited access for training purposes',1,1,'2025-07-29 05:55:36','2025-07-29 05:55:36'),(6,'accounting_specialist','Accounting Specialist','Specialized role for accounting department tasks',0,1,'2025-07-29 05:57:43','2025-07-29 05:57:43'),(7,'academic_coordinator','Academic Coordinator','Coordinates academic department processes',0,1,'2025-07-29 05:57:43','2025-07-29 05:57:43'),(8,'dormitory_supervisor','Dormitory Supervisor','Supervises dormitory operations and requests',0,1,'2025-07-29 05:57:43','2025-07-29 05:57:43'),(9,'student_affairs_officer','Student Affairs Officer','Handles student affairs and disciplinary matters',0,1,'2025-07-29 05:57:43','2025-07-29 05:57:43'),(10,'campus_services_manager','Campus Services Manager','Manages campus facilities and IT services',0,1,'2025-07-29 05:57:43','2025-07-29 05:57:43'),(11,'guest_user','Guest User','Temporary access for guests or vendors',0,1,'2025-07-29 05:57:43','2025-07-29 05:57:43');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `students`
--

DROP TABLE IF EXISTS `students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `students` (
  `student_id` int NOT NULL AUTO_INCREMENT,
  `student_number` varchar(20) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `program` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `profile_photo` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`student_id`),
  UNIQUE KEY `student_number` (`student_number`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_students_student_number` (`student_number`),
  KEY `idx_students_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `students`
--

LOCK TABLES `students` WRITE;
/*!40000 ALTER TABLE `students` DISABLE KEYS */;
INSERT INTO `students` VALUES (1,'20210001','Test Student','test@fiu.edu.tr','$2a$10$s7bhAOlVTaaYiGKcp0RsN.B6r2uc3.ML6TrAUTC3CAS2Z4zNFtEB6','Computer Engineering','2025-07-27 13:15:07','2025-07-27 13:15:07',NULL),(2,'2003060007','Mert','Mert@fiu.edu.tr','$2a$10$s7bhAOlVTaaYiGKcp0RsN.B6r2uc3.ML6TrAUTC3CAS2Z4zNFtEB6','Software Engineering','2025-08-10 08:28:19','2025-08-26 09:20:43','C:Userseren7DesktopEkran görüntüsü 2025-08-26 121743.png');
/*!40000 ALTER TABLE `students` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_roles` (
  `user_id` int NOT NULL,
  `role_id` int NOT NULL,
  `assigned_by` int DEFAULT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`user_id`,`role_id`),
  KEY `role_id` (`role_id`),
  KEY `assigned_by` (`assigned_by`),
  KEY `idx_user_roles_active` (`is_active`),
  KEY `idx_user_roles_expires` (`expires_at`),
  CONSTRAINT `user_roles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `admin_users` (`admin_id`) ON DELETE CASCADE,
  CONSTRAINT `user_roles_ibfk_2` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE CASCADE,
  CONSTRAINT `user_roles_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `admin_users` (`admin_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--

LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` VALUES (1,1,1,'2025-07-29 05:55:36',NULL,0),(1,2,1,'2025-07-29 05:55:36',NULL,1),(2,1,2,'2025-08-04 08:07:54',NULL,0),(2,2,1,'2025-07-29 05:55:36',NULL,1),(3,2,1,'2025-07-29 05:55:36',NULL,1),(5,1,1,'2025-08-04 10:25:26',NULL,0),(5,2,1,'2025-07-29 05:55:36',NULL,1),(11,1,11,'2025-08-10 08:05:22',NULL,1),(11,2,11,'2025-08-10 08:04:32',NULL,0),(12,3,1,'2025-08-05 09:44:58',NULL,1),(13,3,11,'2025-08-05 12:41:51',NULL,1),(14,4,11,'2025-08-21 07:16:06',NULL,1);
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Final view structure for view `active_calendar_events`
--

/*!50001 DROP VIEW IF EXISTS `active_calendar_events`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `active_calendar_events` AS select `ace`.`event_id` AS `event_id`,`ace`.`upload_id` AS `upload_id`,`ace`.`event_type` AS `event_type`,`ace`.`event_name` AS `event_name`,`ace`.`event_name_en` AS `event_name_en`,`ace`.`start_date` AS `start_date`,`ace`.`end_date` AS `end_date`,`ace`.`is_recurring` AS `is_recurring`,`ace`.`recurring_type` AS `recurring_type`,`ace`.`description` AS `description`,`ace`.`affects_request_creation` AS `affects_request_creation`,`ace`.`created_at` AS `created_at`,`ace`.`updated_at` AS `updated_at`,`acu`.`academic_year` AS `academic_year`,`acu`.`file_name` AS `source_file` from (`academic_calendar_events` `ace` join `academic_calendar_uploads` `acu` on((`ace`.`upload_id` = `acu`.`upload_id`))) where ((`acu`.`is_active` = true) and (`acu`.`processing_status` = 'completed') and (`acu`.`academic_year` = (select `academic_settings`.`setting_value` from `academic_settings` where (`academic_settings`.`setting_key` = 'current_academic_year')))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `admin_performance_view`
--

/*!50001 DROP VIEW IF EXISTS `admin_performance_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `admin_performance_view` AS select `au`.`admin_id` AS `admin_id`,`au`.`username` AS `username`,`au`.`full_name` AS `full_name`,`au`.`name` AS `name`,`au`.`email` AS `email`,`au`.`department` AS `department`,`au`.`is_super_admin` AS `is_super_admin`,`au`.`is_active` AS `is_active`,`au`.`created_at` AS `admin_since`,count(distinct `gr`.`request_id`) AS `total_assigned_requests`,count(distinct (case when (`gr`.`status` = 'Completed') then `gr`.`request_id` end)) AS `completed_requests`,count(distinct (case when (`gr`.`status` = 'Pending') then `gr`.`request_id` end)) AS `pending_requests`,count(distinct (case when (`gr`.`status` = 'Informed') then `gr`.`request_id` end)) AS `informed_requests`,count(distinct (case when (`gr`.`status` = 'Rejected') then `gr`.`request_id` end)) AS `rejected_requests`,count(distinct `ar`.`response_id`) AS `total_responses`,round((case when (count(distinct `gr`.`request_id`) > 0) then ((count(distinct (case when (`gr`.`status` = 'Completed') then `gr`.`request_id` end)) * 100.0) / count(distinct `gr`.`request_id`)) else 0 end),1) AS `completion_rate`,round(avg((case when ((`ar`.`created_at` is not null) and (`gr`.`submitted_at` is not null)) then timestampdiff(HOUR,`gr`.`submitted_at`,`ar`.`created_at`) else NULL end)),2) AS `avg_response_time_hours`,`aws`.`current_pending` AS `current_pending`,`aws`.`current_informed` AS `current_informed`,`aws`.`workload_score` AS `workload_score`,min(`gr`.`assigned_at`) AS `first_assignment`,max(`gr`.`assigned_at`) AS `last_assignment`,min(`ar`.`created_at`) AS `first_response`,max(`ar`.`created_at`) AS `last_response` from (((`admin_users` `au` left join `guidance_requests` `gr` on((`au`.`admin_id` = `gr`.`assigned_admin_id`))) left join `admin_responses` `ar` on(((`gr`.`request_id` = `ar`.`request_id`) and (`ar`.`admin_id` = `au`.`admin_id`)))) left join `admin_workload_stats` `aws` on((`au`.`admin_id` = `aws`.`admin_id`))) where (`au`.`is_active` = true) group by `au`.`admin_id`,`au`.`username`,`au`.`full_name`,`au`.`name`,`au`.`email`,`au`.`department`,`au`.`is_super_admin`,`au`.`is_active`,`au`.`created_at`,`aws`.`current_pending`,`aws`.`current_informed`,`aws`.`workload_score` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `department_statistics_view`
--

/*!50001 DROP VIEW IF EXISTS `department_statistics_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `department_statistics_view` AS select `rt`.`category` AS `department`,count(distinct `au`.`admin_id`) AS `admin_count`,count(distinct `gr`.`request_id`) AS `total_requests`,count(distinct (case when (`gr`.`status` = 'Completed') then `gr`.`request_id` end)) AS `completed_requests`,count(distinct (case when (`gr`.`status` = 'Pending') then `gr`.`request_id` end)) AS `pending_requests`,count(distinct (case when (`gr`.`status` = 'Informed') then `gr`.`request_id` end)) AS `informed_requests`,count(distinct (case when (`gr`.`status` = 'Rejected') then `gr`.`request_id` end)) AS `rejected_requests`,count(distinct `ar`.`response_id`) AS `total_responses`,count(distinct `gr`.`assigned_admin_id`) AS `admins_with_assignments`,count(distinct (case when (`gr`.`assigned_admin_id` is null) then `gr`.`request_id` end)) AS `unassigned_requests`,round(avg(timestampdiff(HOUR,`gr`.`submitted_at`,`ar`.`created_at`)),2) AS `avg_response_time`,round((case when (count(distinct `gr`.`request_id`) > 0) then ((count(distinct (case when (`gr`.`status` = 'Completed') then `gr`.`request_id` end)) * 100.0) / count(distinct `gr`.`request_id`)) else 0 end),1) AS `completion_rate`,round(((count(distinct `gr`.`request_id`) * 1.0) / nullif(count(distinct `au`.`admin_id`),0)),1) AS `avg_requests_per_admin` from (((`request_types` `rt` left join `guidance_requests` `gr` on((`rt`.`type_id` = `gr`.`type_id`))) left join `admin_responses` `ar` on((`gr`.`request_id` = `ar`.`request_id`))) left join `admin_users` `au` on(((`rt`.`category` = `au`.`department`) and (`au`.`is_active` = true)))) group by `rt`.`category` order by `completion_rate` desc,`total_requests` desc */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-08-26 12:40:55
