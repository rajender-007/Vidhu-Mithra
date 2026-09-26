-- ============================================================
-- Migration 004: Seed Data (Domains, Jurisdictions, Instruments)
-- ============================================================

-- Seed Legal Domains (A-L)
INSERT INTO legal_domains (code, name, description, sub_areas) VALUES
('CIVIL', 'Civil', 'Civil disputes, contracts, money recovery, and damages', ARRAY['Property and land disputes', 'Money recovery', 'Contract disputes', 'Defamation', 'Neighbour disputes', 'Debt disputes', 'Injunction-related matters', 'Civil damages']),
('FAMILY', 'Family & Marriage', 'Family matters, marriage, custody, and succession', ARRAY['Marriage', 'Divorce', 'Maintenance', 'Domestic disputes', 'Child custody', 'Adoption', 'Domestic violence information', 'Inheritance', 'Succession', 'Guardianship']),
('CRIMINAL', 'Criminal', 'Criminal offenses, complaints, and procedures', ARRAY['Theft', 'Fraud', 'Assault', 'Threats', 'Cybercrime', 'Harassment', 'Criminal breach of trust', 'Cheating', 'Missing persons', 'Police-complaint preparation']),
('PROPERTY', 'Property & Real Estate', 'Property ownership, rental, registration, and land matters', ARRAY['Rental agreements', 'Sale agreements', 'Ownership', 'Encumbrance concerns', 'Registration', 'Stamp duty', 'Land records', 'Builder disputes', 'Tenant/landlord matters']),
('EMPLOYMENT', 'Employment', 'Workplace rights, contracts, termination, and disputes', ARRAY['Employment contracts', 'Salary disputes', 'Termination', 'Workplace harassment', 'Notice periods', 'Non-compete and confidentiality', 'Gratuity', 'Leave and benefits']),
('CONSUMER', 'Consumer', 'Consumer protection, refunds, warranty, and e-commerce complaints', ARRAY['Product complaints', 'Service disputes', 'Refunds', 'Warranty', 'E-commerce disputes', 'Banking complaints']),
('BUSINESS', 'Business & Startup', 'Corporate, commercial contracts, and compliance', ARRAY['Founder agreements', 'NDAs', 'Vendor contracts', 'Partnership', 'Incorporation', 'Compliance', 'Intellectual property']),
('CYBER', 'Cyber & Digital', 'Cybercrime, online fraud, data protection, and digital harassment', ARRAY['Online fraud', 'UPI fraud', 'Account hacking', 'Identity theft', 'Cyber harassment', 'Data and privacy concerns', 'Social-media issues']),
('IP', 'Intellectual Property', 'Patents, trademarks, copyright, and trade secrets', ARRAY['Copyright', 'Trademark', 'Patent', 'Brand misuse', 'Content theft']),
('GOVERNMENT', 'Government & Administrative', 'Administrative law, RTI, and government notices', ARRAY['Government notices', 'RTI', 'Public-authority complaints', 'Licences', 'Regulatory issues']),
('TAX', 'Tax & Financial', 'Taxation, financial disputes, insurance, and banking recovery', ARRAY['Tax notices', 'GST-related information', 'Banking disputes', 'Loan recovery', 'Insurance disputes']),
('IMMIGRATION', 'Immigration & Documentation', 'Passports, visas, and documentation validation', ARRAY['Visa-related documentation', 'Passport issues', 'Citizenship documentation', 'Supporting documents'])
ON CONFLICT (code) DO NOTHING;

-- Seed Jurisdictions
INSERT INTO jurisdictions (country, state, district, city, court_authority, level, code) VALUES
('India', NULL, NULL, NULL, 'Supreme Court of India', 'country', 'IN-NATIONAL'),
('India', 'Telangana', NULL, 'Hyderabad', 'High Court for the State of Telangana', 'state', 'IN-TG'),
('India', 'Telangana', 'Hyderabad', 'Hyderabad', 'City Civil Court Hyderabad', 'city', 'IN-TG-HYD'),
('India', 'Maharashtra', NULL, 'Mumbai', 'Bombay High Court', 'state', 'IN-MH'),
('India', 'Maharashtra', 'Mumbai City', 'Mumbai', 'City Civil and Sessions Court Mumbai', 'city', 'IN-MH-MUM'),
('India', 'Karnataka', NULL, 'Bengaluru', 'High Court of Karnataka', 'state', 'IN-KA'),
('India', 'Karnataka', 'Bengaluru Urban', 'Bengaluru', 'City Civil Court Bengaluru', 'city', 'IN-KA-BLR'),
('India', 'Tamil Nadu', NULL, 'Chennai', 'Madras High Court', 'state', 'IN-TN'),
('India', 'Tamil Nadu', 'Chennai', 'Chennai', 'City Civil Court Chennai', 'city', 'IN-TN-CHN'),
('India', 'Delhi', 'New Delhi', 'New Delhi', 'Delhi High Court', 'state', 'IN-DL')
ON CONFLICT (code) DO NOTHING;

-- Seed Initial Legal Instruments
INSERT INTO legal_instruments (code, title, enacted_year, category) VALUES
('IPC', 'Indian Penal Code', 1860, 'Criminal'),
('BNS', 'Bharatiya Nyaya Sanhita', 2023, 'Criminal'),
('CRPC', 'Code of Criminal Procedure', 1973, 'Criminal Procedure'),
('BNSS', 'Bharatiya Nagarik Suraksha Sanhita', 2023, 'Criminal Procedure'),
('IEA', 'Indian Evidence Act', 1872, 'Evidence'),
('BSA', 'Bharatiya Sakshya Adhiniyam', 2023, 'Evidence'),
('ICA', 'Indian Contract Act', 1872, 'Civil/Contract'),
('CPA', 'Consumer Protection Act', 2019, 'Consumer'),
('ITA', 'Information Technology Act', 2000, 'Cyber'),
('TPA', 'Transfer of Property Act', 1882, 'Property'),
('DPDPA', 'Digital Personal Data Protection Act', 2023, 'Privacy'),
('LA', 'Limitation Act', 1963, 'Civil/Limitation')
ON CONFLICT (code) DO NOTHING;
