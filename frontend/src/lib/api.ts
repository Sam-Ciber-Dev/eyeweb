/**
 * Eye Web - Serviço de API
 * Comunicação com o backend FastAPI
 * 
 * ATUALIZADO v2.0:
 * - Suporta emails E telefones
 * - Nova estrutura com campos booleanos
 * - K-Anonymity para ambos os tipos
 */

import { translations, type Lang } from '@/i18n/translations';

/** Lightweight translate helper for non-React contexts */
function tr(key: string, lang: Lang = 'pt'): string {
  return translations[lang]?.[key] ?? translations['pt']?.[key] ?? key;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ===========================================
// TIPOS E INTERFACES (NOVA ESTRUTURA v2.0)
// ===========================================

export interface BreachInfo {
  name: string;
  date: string;
  type: 'email' | 'phone';
  has_password: boolean;
  has_ip: boolean;
  has_username: boolean;
  has_credit_card: boolean;
  has_history: boolean;
}

export interface BreachCandidate {
  hash: string;
  type: string;
  breach_name: string;
  breach_date: string;
  has_password: boolean;
  has_ip: boolean;
  has_username: boolean;
  has_credit_card: boolean;
  has_history: boolean;
}

export interface BreachCheckResponse {
  prefix: string;
  count: number;
  candidates: BreachCandidate[];
}

export interface ApiStats {
  total_records: number;
  total_emails: number;
  total_phones: number;
  total_partitions: number;
  prefix_length: number;
  last_updated: string | null;
}

// ===========================================
// CÓDIGOS DE PAÍS PARA TELEFONES
// ===========================================

export interface CountryCode {
  code: string;
  name: string;
  flag: string;
  minDigits: number;
  maxDigits: number;
}

export const COUNTRY_CODES: CountryCode[] = [
  // A
  { code: '+93', name: 'Afeganistão', flag: '🇦🇫', minDigits: 9, maxDigits: 9 },
  { code: '+27', name: 'África do Sul', flag: '🇿🇦', minDigits: 9, maxDigits: 9 },
  { code: '+355', name: 'Albânia', flag: '🇦🇱', minDigits: 9, maxDigits: 9 },
  { code: '+49', name: 'Alemanha', flag: '🇩🇪', minDigits: 10, maxDigits: 11 },
  { code: '+376', name: 'Andorra', flag: '🇦🇩', minDigits: 6, maxDigits: 9 },
  { code: '+244', name: 'Angola', flag: '🇦🇴', minDigits: 9, maxDigits: 9 },
  { code: '+1264', name: 'Anguila', flag: '🇦🇮', minDigits: 10, maxDigits: 10 },
  { code: '+1268', name: 'Antígua e Barbuda', flag: '🇦🇬', minDigits: 10, maxDigits: 10 },
  { code: '+966', name: 'Arábia Saudita', flag: '🇸🇦', minDigits: 9, maxDigits: 9 },
  { code: '+213', name: 'Argélia', flag: '🇩🇿', minDigits: 9, maxDigits: 9 },
  { code: '+54', name: 'Argentina', flag: '🇦🇷', minDigits: 10, maxDigits: 10 },
  { code: '+374', name: 'Arménia', flag: '🇦🇲', minDigits: 8, maxDigits: 8 },
  { code: '+297', name: 'Aruba', flag: '🇦🇼', minDigits: 7, maxDigits: 7 },
  { code: '+61', name: 'Austrália', flag: '🇦🇺', minDigits: 9, maxDigits: 9 },
  { code: '+43', name: 'Áustria', flag: '🇦🇹', minDigits: 10, maxDigits: 10 },
  { code: '+994', name: 'Azerbaijão', flag: '🇦🇿', minDigits: 9, maxDigits: 9 },
  // B
  { code: '+1242', name: 'Bahamas', flag: '🇧🇸', minDigits: 10, maxDigits: 10 },
  { code: '+880', name: 'Bangladexe', flag: '🇧🇩', minDigits: 10, maxDigits: 10 },
  { code: '+1246', name: 'Barbados', flag: '🇧🇧', minDigits: 10, maxDigits: 10 },
  { code: '+973', name: 'Barém', flag: '🇧🇭', minDigits: 8, maxDigits: 8 },
  { code: '+32', name: 'Bélgica', flag: '🇧🇪', minDigits: 9, maxDigits: 9 },
  { code: '+501', name: 'Belize', flag: '🇧🇿', minDigits: 7, maxDigits: 7 },
  { code: '+229', name: 'Benim', flag: '🇧🇯', minDigits: 8, maxDigits: 8 },
  { code: '+1441', name: 'Bermudas', flag: '🇧🇲', minDigits: 10, maxDigits: 10 },
  { code: '+375', name: 'Bielorrússia', flag: '🇧🇾', minDigits: 9, maxDigits: 9 },
  { code: '+591', name: 'Bolívia', flag: '🇧🇴', minDigits: 8, maxDigits: 8 },
  { code: '+387', name: 'Bósnia e Herzegovina', flag: '🇧🇦', minDigits: 8, maxDigits: 8 },
  { code: '+267', name: 'Botsuana', flag: '🇧🇼', minDigits: 8, maxDigits: 8 },
  { code: '+55', name: 'Brasil', flag: '🇧🇷', minDigits: 10, maxDigits: 11 },
  { code: '+673', name: 'Brunei', flag: '🇧🇳', minDigits: 7, maxDigits: 7 },
  { code: '+359', name: 'Bulgária', flag: '🇧🇬', minDigits: 9, maxDigits: 9 },
  { code: '+226', name: 'Burquina Faso', flag: '🇧🇫', minDigits: 8, maxDigits: 8 },
  { code: '+257', name: 'Burundi', flag: '🇧🇮', minDigits: 8, maxDigits: 8 },
  // C
  { code: '+238', name: 'Cabo Verde', flag: '🇨🇻', minDigits: 7, maxDigits: 7 },
  { code: '+237', name: 'Camarões', flag: '🇨🇲', minDigits: 9, maxDigits: 9 },
  { code: '+855', name: 'Camboja', flag: '🇰🇭', minDigits: 8, maxDigits: 9 },
  { code: '+1', name: 'Canadá', flag: '🇨🇦', minDigits: 10, maxDigits: 10 },
  { code: '+974', name: 'Catar', flag: '🇶🇦', minDigits: 8, maxDigits: 8 },
  { code: '+7', name: 'Cazaquistão', flag: '🇰🇿', minDigits: 10, maxDigits: 10 },
  { code: '+235', name: 'Chade', flag: '🇹🇩', minDigits: 8, maxDigits: 8 },
  { code: '+56', name: 'Chile', flag: '🇨🇱', minDigits: 9, maxDigits: 9 },
  { code: '+86', name: 'China', flag: '🇨🇳', minDigits: 11, maxDigits: 11 },
  { code: '+357', name: 'Chipre', flag: '🇨🇾', minDigits: 8, maxDigits: 8 },
  { code: '+57', name: 'Colômbia', flag: '🇨🇴', minDigits: 10, maxDigits: 10 },
  { code: '+269', name: 'Comores', flag: '🇰🇲', minDigits: 7, maxDigits: 7 },
  { code: '+242', name: 'Congo-Brazzaville', flag: '🇨🇬', minDigits: 9, maxDigits: 9 },
  { code: '+850', name: 'Coreia do Norte', flag: '🇰🇵', minDigits: 8, maxDigits: 10 },
  { code: '+82', name: 'Coreia do Sul', flag: '🇰🇷', minDigits: 9, maxDigits: 10 },
  { code: '+225', name: 'Costa do Marfim', flag: '🇨🇮', minDigits: 10, maxDigits: 10 },
  { code: '+506', name: 'Costa Rica', flag: '🇨🇷', minDigits: 8, maxDigits: 8 },
  { code: '+385', name: 'Croácia', flag: '🇭🇷', minDigits: 9, maxDigits: 9 },
  { code: '+53', name: 'Cuba', flag: '🇨🇺', minDigits: 8, maxDigits: 8 },
  { code: '+599', name: 'Curaçau', flag: '🇨🇼', minDigits: 7, maxDigits: 8 },
  // D
  { code: '+45', name: 'Dinamarca', flag: '🇩🇰', minDigits: 8, maxDigits: 8 },
  { code: '+253', name: 'Djibouti', flag: '🇩🇯', minDigits: 8, maxDigits: 8 },
  { code: '+1767', name: 'Dominica', flag: '🇩🇲', minDigits: 10, maxDigits: 10 },
  // E
  { code: '+20', name: 'Egito', flag: '🇪🇬', minDigits: 10, maxDigits: 10 },
  { code: '+503', name: 'El Salvador', flag: '🇸🇻', minDigits: 8, maxDigits: 8 },
  { code: '+971', name: 'Emirados Árabes Unidos', flag: '🇦🇪', minDigits: 9, maxDigits: 9 },
  { code: '+593', name: 'Equador', flag: '🇪🇨', minDigits: 9, maxDigits: 9 },
  { code: '+291', name: 'Eritreia', flag: '🇪🇷', minDigits: 7, maxDigits: 7 },
  { code: '+421', name: 'Eslováquia', flag: '🇸🇰', minDigits: 9, maxDigits: 9 },
  { code: '+386', name: 'Eslovénia', flag: '🇸🇮', minDigits: 8, maxDigits: 8 },
  { code: '+34', name: 'Espanha', flag: '🇪🇸', minDigits: 9, maxDigits: 9 },
  { code: '+1', name: 'Estados Unidos', flag: '🇺🇸', minDigits: 10, maxDigits: 10 },
  { code: '+372', name: 'Estónia', flag: '🇪🇪', minDigits: 7, maxDigits: 8 },
  { code: '+251', name: 'Etiópia', flag: '🇪🇹', minDigits: 9, maxDigits: 9 },
  // F
  { code: '+679', name: 'Fiji', flag: '🇫🇯', minDigits: 7, maxDigits: 7 },
  { code: '+63', name: 'Filipinas', flag: '🇵🇭', minDigits: 10, maxDigits: 10 },
  { code: '+358', name: 'Finlândia', flag: '🇫🇮', minDigits: 9, maxDigits: 10 },
  { code: '+33', name: 'França', flag: '🇫🇷', minDigits: 9, maxDigits: 9 },
  // G
  { code: '+241', name: 'Gabão', flag: '🇬🇦', minDigits: 7, maxDigits: 8 },
  { code: '+220', name: 'Gâmbia', flag: '🇬🇲', minDigits: 7, maxDigits: 7 },
  { code: '+233', name: 'Gana', flag: '🇬🇭', minDigits: 9, maxDigits: 9 },
  { code: '+995', name: 'Geórgia', flag: '🇬🇪', minDigits: 9, maxDigits: 9 },
  { code: '+350', name: 'Gibraltar', flag: '🇬🇮', minDigits: 8, maxDigits: 8 },
  { code: '+1473', name: 'Granada', flag: '🇬🇩', minDigits: 10, maxDigits: 10 },
  { code: '+30', name: 'Grécia', flag: '🇬🇷', minDigits: 10, maxDigits: 10 },
  { code: '+299', name: 'Gronelândia', flag: '🇬🇱', minDigits: 6, maxDigits: 6 },
  { code: '+590', name: 'Guadalupe', flag: '🇬🇵', minDigits: 9, maxDigits: 9 },
  { code: '+1671', name: 'Guame', flag: '🇬🇺', minDigits: 10, maxDigits: 10 },
  { code: '+502', name: 'Guatemala', flag: '🇬🇹', minDigits: 8, maxDigits: 8 },
  { code: '+592', name: 'Guiana', flag: '🇬🇾', minDigits: 7, maxDigits: 7 },
  { code: '+594', name: 'Guiana Francesa', flag: '🇬🇫', minDigits: 9, maxDigits: 9 },
  { code: '+224', name: 'Guiné', flag: '🇬🇳', minDigits: 9, maxDigits: 9 },
  { code: '+240', name: 'Guiné Equatorial', flag: '🇬🇶', minDigits: 9, maxDigits: 9 },
  { code: '+245', name: 'Guiné-Bissau', flag: '🇬🇼', minDigits: 7, maxDigits: 7 },
  // H
  { code: '+509', name: 'Haiti', flag: '🇭🇹', minDigits: 8, maxDigits: 8 },
  { code: '+504', name: 'Honduras', flag: '🇭🇳', minDigits: 8, maxDigits: 8 },
  { code: '+852', name: 'Hong Kong', flag: '🇭🇰', minDigits: 8, maxDigits: 8 },
  { code: '+36', name: 'Hungria', flag: '🇭🇺', minDigits: 9, maxDigits: 9 },
  // I
  { code: '+967', name: 'Iémen', flag: '🇾🇪', minDigits: 9, maxDigits: 9 },
  { code: '+1345', name: 'Ilhas Caimão', flag: '🇰🇾', minDigits: 10, maxDigits: 10 },
  { code: '+682', name: 'Ilhas Cook', flag: '🇨🇰', minDigits: 5, maxDigits: 5 },
  { code: '+298', name: 'Ilhas Faroé', flag: '🇫🇴', minDigits: 6, maxDigits: 6 },
  { code: '+500', name: 'Ilhas Malvinas', flag: '🇫🇰', minDigits: 5, maxDigits: 5 },
  { code: '+692', name: 'Ilhas Marshall', flag: '🇲🇭', minDigits: 7, maxDigits: 7 },
  { code: '+677', name: 'Ilhas Salomão', flag: '🇸🇧', minDigits: 7, maxDigits: 7 },
  { code: '+1284', name: 'Ilhas Virgens Britânicas', flag: '🇻🇬', minDigits: 10, maxDigits: 10 },
  { code: '+1340', name: 'Ilhas Virgens Americanas', flag: '🇻🇮', minDigits: 10, maxDigits: 10 },
  { code: '+91', name: 'Índia', flag: '🇮🇳', minDigits: 10, maxDigits: 10 },
  { code: '+62', name: 'Indonésia', flag: '🇮🇩', minDigits: 9, maxDigits: 12 },
  { code: '+98', name: 'Irão', flag: '🇮🇷', minDigits: 10, maxDigits: 10 },
  { code: '+964', name: 'Iraque', flag: '🇮🇶', minDigits: 10, maxDigits: 10 },
  { code: '+353', name: 'Irlanda', flag: '🇮🇪', minDigits: 9, maxDigits: 9 },
  { code: '+354', name: 'Islândia', flag: '🇮🇸', minDigits: 7, maxDigits: 7 },
  { code: '+972', name: 'Israel', flag: '🇮🇱', minDigits: 9, maxDigits: 9 },
  { code: '+39', name: 'Itália', flag: '🇮🇹', minDigits: 9, maxDigits: 10 },
  // J
  { code: '+1876', name: 'Jamaica', flag: '🇯🇲', minDigits: 10, maxDigits: 10 },
  { code: '+81', name: 'Japão', flag: '🇯🇵', minDigits: 10, maxDigits: 10 },
  { code: '+962', name: 'Jordânia', flag: '🇯🇴', minDigits: 9, maxDigits: 9 },
  // L
  { code: '+856', name: 'Laos', flag: '🇱🇦', minDigits: 8, maxDigits: 10 },
  { code: '+266', name: 'Lesoto', flag: '🇱🇸', minDigits: 8, maxDigits: 8 },
  { code: '+371', name: 'Letónia', flag: '🇱🇻', minDigits: 8, maxDigits: 8 },
  { code: '+961', name: 'Líbano', flag: '🇱🇧', minDigits: 7, maxDigits: 8 },
  { code: '+231', name: 'Libéria', flag: '🇱🇷', minDigits: 7, maxDigits: 9 },
  { code: '+218', name: 'Líbia', flag: '🇱🇾', minDigits: 9, maxDigits: 9 },
  { code: '+423', name: 'Listenstaine', flag: '🇱🇮', minDigits: 7, maxDigits: 7 },
  { code: '+370', name: 'Lituânia', flag: '🇱🇹', minDigits: 8, maxDigits: 8 },
  { code: '+352', name: 'Luxemburgo', flag: '🇱🇺', minDigits: 9, maxDigits: 9 },
  // M
  { code: '+853', name: 'Macau', flag: '🇲🇴', minDigits: 8, maxDigits: 8 },
  { code: '+389', name: 'Macedónia do Norte', flag: '🇲🇰', minDigits: 8, maxDigits: 8 },
  { code: '+261', name: 'Madagascar', flag: '🇲🇬', minDigits: 9, maxDigits: 10 },
  { code: '+60', name: 'Malásia', flag: '🇲🇾', minDigits: 9, maxDigits: 10 },
  { code: '+265', name: 'Maláui', flag: '🇲🇼', minDigits: 9, maxDigits: 9 },
  { code: '+960', name: 'Maldivas', flag: '🇲🇻', minDigits: 7, maxDigits: 7 },
  { code: '+223', name: 'Mali', flag: '🇲🇱', minDigits: 8, maxDigits: 8 },
  { code: '+356', name: 'Malta', flag: '🇲🇹', minDigits: 8, maxDigits: 8 },
  { code: '+212', name: 'Marrocos', flag: '🇲🇦', minDigits: 9, maxDigits: 9 },
  { code: '+596', name: 'Martinica', flag: '🇲🇶', minDigits: 9, maxDigits: 9 },
  { code: '+230', name: 'Maurícia', flag: '🇲🇺', minDigits: 8, maxDigits: 8 },
  { code: '+222', name: 'Mauritânia', flag: '🇲🇷', minDigits: 8, maxDigits: 8 },
  { code: '+52', name: 'México', flag: '🇲🇽', minDigits: 10, maxDigits: 10 },
  { code: '+95', name: 'Mianmar', flag: '🇲🇲', minDigits: 8, maxDigits: 10 },
  { code: '+691', name: 'Micronésia', flag: '🇫🇲', minDigits: 7, maxDigits: 7 },
  { code: '+258', name: 'Moçambique', flag: '🇲🇿', minDigits: 9, maxDigits: 9 },
  { code: '+373', name: 'Moldávia', flag: '🇲🇩', minDigits: 8, maxDigits: 8 },
  { code: '+377', name: 'Mónaco', flag: '🇲🇨', minDigits: 8, maxDigits: 9 },
  { code: '+976', name: 'Mongólia', flag: '🇲🇳', minDigits: 8, maxDigits: 8 },
  { code: '+382', name: 'Montenegro', flag: '🇲🇪', minDigits: 8, maxDigits: 8 },
  { code: '+1664', name: 'Monserrate', flag: '🇲🇸', minDigits: 10, maxDigits: 10 },
  // N
  { code: '+264', name: 'Namíbia', flag: '🇳🇦', minDigits: 9, maxDigits: 9 },
  { code: '+674', name: 'Nauru', flag: '🇳🇷', minDigits: 7, maxDigits: 7 },
  { code: '+977', name: 'Nepal', flag: '🇳🇵', minDigits: 10, maxDigits: 10 },
  { code: '+505', name: 'Nicarágua', flag: '🇳🇮', minDigits: 8, maxDigits: 8 },
  { code: '+227', name: 'Níger', flag: '🇳🇪', minDigits: 8, maxDigits: 8 },
  { code: '+234', name: 'Nigéria', flag: '🇳🇬', minDigits: 10, maxDigits: 10 },
  { code: '+683', name: 'Niue', flag: '🇳🇺', minDigits: 4, maxDigits: 4 },
  { code: '+47', name: 'Noruega', flag: '🇳🇴', minDigits: 8, maxDigits: 8 },
  { code: '+687', name: 'Nova Caledónia', flag: '🇳🇨', minDigits: 6, maxDigits: 6 },
  { code: '+64', name: 'Nova Zelândia', flag: '🇳🇿', minDigits: 9, maxDigits: 10 },
  // O
  { code: '+968', name: 'Omã', flag: '🇴🇲', minDigits: 8, maxDigits: 8 },
  // P
  { code: '+31', name: 'Países Baixos', flag: '🇳🇱', minDigits: 9, maxDigits: 9 },
  { code: '+680', name: 'Palau', flag: '🇵🇼', minDigits: 7, maxDigits: 7 },
  { code: '+970', name: 'Palestina', flag: '🇵🇸', minDigits: 9, maxDigits: 9 },
  { code: '+507', name: 'Panamá', flag: '🇵🇦', minDigits: 8, maxDigits: 8 },
  { code: '+675', name: 'Papua Nova Guiné', flag: '🇵🇬', minDigits: 8, maxDigits: 8 },
  { code: '+92', name: 'Paquistão', flag: '🇵🇰', minDigits: 10, maxDigits: 10 },
  { code: '+595', name: 'Paraguai', flag: '🇵🇾', minDigits: 9, maxDigits: 9 },
  { code: '+51', name: 'Peru', flag: '🇵🇪', minDigits: 9, maxDigits: 9 },
  { code: '+689', name: 'Polinésia Francesa', flag: '🇵🇫', minDigits: 6, maxDigits: 6 },
  { code: '+48', name: 'Polónia', flag: '🇵🇱', minDigits: 9, maxDigits: 9 },
  { code: '+1787', name: 'Porto Rico', flag: '🇵🇷', minDigits: 10, maxDigits: 10 },
  { code: '+351', name: 'Portugal', flag: '🇵🇹', minDigits: 9, maxDigits: 9 },
  // Q
  { code: '+254', name: 'Quénia', flag: '🇰🇪', minDigits: 9, maxDigits: 9 },
  { code: '+996', name: 'Quirguistão', flag: '🇰🇬', minDigits: 9, maxDigits: 9 },
  { code: '+686', name: 'Quiribáti', flag: '🇰🇮', minDigits: 5, maxDigits: 8 },
  // R
  { code: '+44', name: 'Reino Unido', flag: '🇬🇧', minDigits: 10, maxDigits: 10 },
  { code: '+236', name: 'República Centro-Africana', flag: '🇨🇫', minDigits: 8, maxDigits: 8 },
  { code: '+420', name: 'República Checa', flag: '🇨🇿', minDigits: 9, maxDigits: 9 },
  { code: '+243', name: 'República Democrática do Congo', flag: '🇨🇩', minDigits: 9, maxDigits: 9 },
  { code: '+1809', name: 'República Dominicana', flag: '🇩🇴', minDigits: 10, maxDigits: 10 },
  { code: '+262', name: 'Reunião', flag: '🇷🇪', minDigits: 9, maxDigits: 9 },
  { code: '+40', name: 'Roménia', flag: '🇷🇴', minDigits: 9, maxDigits: 9 },
  { code: '+250', name: 'Ruanda', flag: '🇷🇼', minDigits: 9, maxDigits: 9 },
  { code: '+7', name: 'Rússia', flag: '🇷🇺', minDigits: 10, maxDigits: 10 },
  // S
  { code: '+685', name: 'Samoa', flag: '🇼🇸', minDigits: 7, maxDigits: 7 },
  { code: '+1684', name: 'Samoa Americana', flag: '🇦🇸', minDigits: 10, maxDigits: 10 },
  { code: '+290', name: 'Santa Helena', flag: '🇸🇭', minDigits: 4, maxDigits: 4 },
  { code: '+1758', name: 'Santa Lúcia', flag: '🇱🇨', minDigits: 10, maxDigits: 10 },
  { code: '+1869', name: 'São Cristóvão e Neves', flag: '🇰🇳', minDigits: 10, maxDigits: 10 },
  { code: '+378', name: 'São Marinho', flag: '🇸🇲', minDigits: 10, maxDigits: 10 },
  { code: '+508', name: 'São Pedro e Miquelão', flag: '🇵🇲', minDigits: 6, maxDigits: 6 },
  { code: '+239', name: 'São Tomé e Príncipe', flag: '🇸🇹', minDigits: 7, maxDigits: 7 },
  { code: '+1784', name: 'São Vicente e Granadinas', flag: '🇻🇨', minDigits: 10, maxDigits: 10 },
  { code: '+221', name: 'Senegal', flag: '🇸🇳', minDigits: 9, maxDigits: 9 },
  { code: '+232', name: 'Serra Leoa', flag: '🇸🇱', minDigits: 8, maxDigits: 8 },
  { code: '+381', name: 'Sérvia', flag: '🇷🇸', minDigits: 9, maxDigits: 9 },
  { code: '+248', name: 'Seicheles', flag: '🇸🇨', minDigits: 7, maxDigits: 7 },
  { code: '+65', name: 'Singapura', flag: '🇸🇬', minDigits: 8, maxDigits: 8 },
  { code: '+1721', name: 'Sint Maarten', flag: '🇸🇽', minDigits: 10, maxDigits: 10 },
  { code: '+963', name: 'Síria', flag: '🇸🇾', minDigits: 9, maxDigits: 9 },
  { code: '+252', name: 'Somália', flag: '🇸🇴', minDigits: 8, maxDigits: 9 },
  { code: '+94', name: 'Sri Lanca', flag: '🇱🇰', minDigits: 9, maxDigits: 9 },
  { code: '+268', name: 'Suazilândia', flag: '🇸🇿', minDigits: 8, maxDigits: 8 },
  { code: '+249', name: 'Sudão', flag: '🇸🇩', minDigits: 9, maxDigits: 9 },
  { code: '+211', name: 'Sudão do Sul', flag: '🇸🇸', minDigits: 9, maxDigits: 9 },
  { code: '+46', name: 'Suécia', flag: '🇸🇪', minDigits: 9, maxDigits: 9 },
  { code: '+41', name: 'Suíça', flag: '🇨🇭', minDigits: 9, maxDigits: 9 },
  { code: '+597', name: 'Suriname', flag: '🇸🇷', minDigits: 7, maxDigits: 7 },
  // T
  { code: '+66', name: 'Tailândia', flag: '🇹🇭', minDigits: 9, maxDigits: 9 },
  { code: '+886', name: 'Taiwan', flag: '🇹🇼', minDigits: 9, maxDigits: 9 },
  { code: '+992', name: 'Tajiquistão', flag: '🇹🇯', minDigits: 9, maxDigits: 9 },
  { code: '+255', name: 'Tanzânia', flag: '🇹🇿', minDigits: 9, maxDigits: 9 },
  { code: '+670', name: 'Timor-Leste', flag: '🇹🇱', minDigits: 7, maxDigits: 8 },
  { code: '+228', name: 'Togo', flag: '🇹🇬', minDigits: 8, maxDigits: 8 },
  { code: '+676', name: 'Tonga', flag: '🇹🇴', minDigits: 5, maxDigits: 7 },
  { code: '+1868', name: 'Trindade e Tobago', flag: '🇹🇹', minDigits: 10, maxDigits: 10 },
  { code: '+216', name: 'Tunísia', flag: '🇹🇳', minDigits: 8, maxDigits: 8 },
  { code: '+993', name: 'Turquemenistão', flag: '🇹🇲', minDigits: 8, maxDigits: 8 },
  { code: '+90', name: 'Turquia', flag: '🇹🇷', minDigits: 10, maxDigits: 10 },
  { code: '+688', name: 'Tuvalu', flag: '🇹🇻', minDigits: 5, maxDigits: 6 },
  // U
  { code: '+380', name: 'Ucrânia', flag: '🇺🇦', minDigits: 9, maxDigits: 9 },
  { code: '+256', name: 'Uganda', flag: '🇺🇬', minDigits: 9, maxDigits: 9 },
  { code: '+598', name: 'Uruguai', flag: '🇺🇾', minDigits: 8, maxDigits: 8 },
  { code: '+998', name: 'Usbequistão', flag: '🇺🇿', minDigits: 9, maxDigits: 9 },
  // V
  { code: '+678', name: 'Vanuatu', flag: '🇻🇺', minDigits: 7, maxDigits: 7 },
  { code: '+379', name: 'Vaticano', flag: '🇻🇦', minDigits: 10, maxDigits: 10 },
  { code: '+58', name: 'Venezuela', flag: '🇻🇪', minDigits: 10, maxDigits: 10 },
  { code: '+84', name: 'Vietname', flag: '🇻🇳', minDigits: 9, maxDigits: 10 },
  // Z
  { code: '+260', name: 'Zâmbia', flag: '🇿🇲', minDigits: 9, maxDigits: 9 },
  { code: '+263', name: 'Zimbabué', flag: '🇿🇼', minDigits: 9, maxDigits: 9 },
];

// ===========================================
// FUNÇÕES DE HASH E NORMALIZAÇÃO
// ===========================================

/**
 * Calcula o hash SHA-256 de uma string
 * Usa a Web Crypto API (disponível no browser)
 */
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Normaliza um email para consistência no hashing
 * DEVE ser idêntica à função no backend!
 */
export function normalizeEmail(email: string): string {
  let normalized = email.trim().toLowerCase();
  
  // Tratamento especial para Gmail
  if (normalized.includes('@gmail.com')) {
    const [username, domain] = normalized.split('@');
    const cleanUsername = username.replace(/\./g, '').split('+')[0];
    normalized = `${cleanUsername}@${domain}`;
  }
  
  return normalized;
}

/**
 * Normaliza um número de telefone para consistência no hashing
 * DEVE ser idêntica à função no backend!
 */
export function normalizePhone(phone: string, countryCode: string): string {
  // Remover tudo exceto dígitos
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Garantir que o código de país começa com +
  const code = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
  
  // Formato final: +XXXYYYYYYYYY
  return `${code}${digitsOnly}`;
}

// ===========================================
// FUNÇÕES DE API
// ===========================================

/**
 * Verifica se um email foi exposto em fugas de dados
 * Implementa K-Anonymity: apenas o prefixo do hash é enviado
 */
export async function checkEmailBreach(email: string): Promise<{
  found: boolean;
  breaches: BreachInfo[];
  fullHash: string;
}> {
  // 1. Normalizar e calcular hash SHA-256 localmente
  const normalizedEmail = normalizeEmail(email);
  const fullHash = await sha256(normalizedEmail);
  const prefix = fullHash.substring(0, 5);
  
  // 2. Enviar apenas o prefixo para a API (K-Anonymity)
  const response = await fetch(`${API_BASE_URL}/api/v1/breaches/check/${prefix}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  
  const data: BreachCheckResponse = await response.json();
  
  // 3. Verificar localmente se o hash completo está na lista (K-Anonymity)
  const matchedBreaches: BreachInfo[] = [];
  
  for (const candidate of data.candidates) {
    if (candidate.hash === fullHash) {
      matchedBreaches.push({
        name: candidate.breach_name,
        date: candidate.breach_date,
        type: candidate.type as 'email' | 'phone',
        has_password: candidate.has_password,
        has_ip: candidate.has_ip,
        has_username: candidate.has_username,
        has_credit_card: candidate.has_credit_card,
        has_history: candidate.has_history,
      });
    }
  }
  
  return { found: matchedBreaches.length > 0, breaches: matchedBreaches, fullHash };
}

/**
 * Verifica se um telefone foi exposto em fugas de dados
 * Implementa K-Anonymity: apenas o prefixo do hash é enviado
 */
export async function checkPhoneBreach(phone: string, countryCode: string): Promise<{
  found: boolean;
  breaches: BreachInfo[];
  fullHash: string;
}> {
  // 1. Normalizar e calcular hash SHA-256 localmente
  const normalizedPhone = normalizePhone(phone, countryCode);
  const fullHash = await sha256(normalizedPhone);
  const prefix = fullHash.substring(0, 5);
  
  // 2. Enviar apenas o prefixo para a API (K-Anonymity)
  const response = await fetch(`${API_BASE_URL}/api/v1/breaches/check/${prefix}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  
  const data: BreachCheckResponse = await response.json();
  
  // 3. Verificar localmente se o hash completo está na lista (K-Anonymity)
  const matchedBreaches: BreachInfo[] = [];
  
  for (const candidate of data.candidates) {
    if (candidate.hash === fullHash) {
      matchedBreaches.push({
        name: candidate.breach_name,
        date: candidate.breach_date,
        type: candidate.type as 'email' | 'phone',
        has_password: candidate.has_password,
        has_ip: candidate.has_ip,
        has_username: candidate.has_username,
        has_credit_card: candidate.has_credit_card,
        has_history: candidate.has_history,
      });
    }
  }
  
  return { found: matchedBreaches.length > 0, breaches: matchedBreaches, fullHash };
}

/**
 * Verifica a força de uma password (verificação local)
 * Não envia para nenhum servidor
 */
export function checkPasswordStrength(password: string, lang: Lang = 'pt'): {
  score: number;
  feedback: string[];
  level: 'weak' | 'medium' | 'strong' | 'very-strong';
} {
  const feedback: string[] = [];
  let score = 0;
  
  // Comprimento
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (password.length < 8) feedback.push(tr('api.pwd.minChars', lang));
  
  // Letras minúsculas
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push(tr('api.pwd.lowercase', lang));
  
  // Letras maiúsculas
  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push(tr('api.pwd.uppercase', lang));
  
  // Números
  if (/[0-9]/.test(password)) score += 1;
  else feedback.push(tr('api.pwd.numbers', lang));
  
  // Caracteres especiais
  if (/[^A-Za-z0-9]/.test(password)) score += 2;
  else feedback.push(tr('api.pwd.special', lang));
  
  // Padrões comuns (penalização)
  const commonPatterns = [
    /^123/, /abc/i, /qwerty/i, /password/i, /admin/i,
    /(.)\1{2,}/, // 3+ caracteres repetidos
  ];
  
  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      score -= 1;
      feedback.push(tr('api.pwd.patterns', lang));
      break;
    }
  }
  
  // Determinar nível
  let level: 'weak' | 'medium' | 'strong' | 'very-strong';
  if (score <= 3) level = 'weak';
  else if (score <= 5) level = 'medium';
  else if (score <= 7) level = 'strong';
  else level = 'very-strong';
  
  return { score: Math.max(0, Math.min(10, score)), feedback, level };
}

/**
 * Verifica se uma password foi exposta em fugas de dados
 * Implementa K-Anonymity: apenas o prefixo do hash é enviado
 * 
 * IMPORTANTE: A password NUNCA é enviada para o servidor!
 * Apenas os primeiros 5 caracteres do hash SHA-256 são enviados.
 */
export async function checkPasswordBreach(password: string): Promise<{
  found: boolean;
  breachCount: number;
  fullHash: string;
}> {
  // 1. Calcular hash SHA-256 localmente (password em plain text)
  const fullHash = await sha256(password);
  const prefix = fullHash.substring(0, 5);
  
  // 2. Enviar apenas o prefixo para a API (K-Anonymity)
  const response = await fetch(`${API_BASE_URL}/api/v1/passwords/check/${prefix}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });
  
  // Se o endpoint não existir ainda, retornar que não foi encontrado
  if (response.status === 404) {
    return { found: false, breachCount: 0, fullHash };
  }
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // 3. Verificar localmente se o hash completo está na lista (K-Anonymity)
  let matchCount = 0;
  
  for (const candidate of data.candidates || []) {
    if (candidate.hash === fullHash) {
      matchCount++;
    }
  }
  
  return { found: matchCount > 0, breachCount: matchCount, fullHash };
}

// ===========================================
// URL CHECKER - Verificação com IA
// ===========================================

export interface UrlCheckResult {
  url: string;
  url_hash: string;
  status: 'safe' | 'suspicious' | 'malicious' | 'unknown' | 'analyzing';
  ai_opinion: string | null;
  threat_details: {
    google_safe_browsing?: {
      checked: boolean;
      is_threat?: boolean;
      threats?: string[];
      source?: string;
      error?: string;
    };
    ssl_check?: {
      checked: boolean;
      has_ssl?: boolean;
      status?: 'safe' | 'suspicious' | 'malicious' | 'unknown';
      reason?: string;
      issuer?: string;
      subject?: string;
      expiry?: string;
      error?: string;
      source?: string;
    };
  };
  last_check: string;
  from_cache: boolean;
  cache_age_seconds: number | null;
  recheck_triggered: boolean | null;
}

/**
 * Verifica a segurança de um URL usando a API com IA
 * Utiliza Google Safe Browsing, SSL Check e Groq AI (Llama 3)
 */
export async function checkUrlWithAI(url: string, forceRecheck: boolean = false, lang: Lang = 'pt'): Promise<UrlCheckResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/urls/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: url,
      force_recheck: forceRecheck,
      lang: lang,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: tr('api.url.unknownError', lang) }));
    throw new Error(error.detail || `${tr('api.url.unknownError', lang)} ${response.status}`);
  }

  return response.json();
}

/**
 * Verifica se um URL parece suspeito (verificação básica local)
 * NOTA: Esta função é mantida para verificação offline/fallback
 */
export function checkUrlSecurity(url: string, lang: Lang = 'pt'): {
  safe: boolean;
  warnings: string[];
  details: { https: boolean; suspiciousTLD: boolean; ipAddress: boolean };
} {
  const warnings: string[] = [];
  
  let parsedUrl: URL;
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    parsedUrl = new URL(url);
  } catch {
    return {
      safe: false,
      warnings: [tr('api.url.invalid', lang)],
      details: { https: false, suspiciousTLD: false, ipAddress: false },
    };
  }
  
  // Verificar HTTPS
  const https = parsedUrl.protocol === 'https:';
  if (!https) {
    warnings.push(tr('api.url.noHttps', lang));
  }
  
  // Verificar TLDs suspeitos
  const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.click', '.link'];
  const suspiciousTLD = suspiciousTLDs.some(tld => parsedUrl.hostname.endsWith(tld));
  if (suspiciousTLD) {
    warnings.push(tr('api.url.phishingTld', lang));
  }
  
  // Verificar se é IP direto
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipAddress = ipPattern.test(parsedUrl.hostname);
  if (ipAddress) {
    warnings.push(tr('api.url.directIp', lang));
  }
  
  // Verificar caracteres suspeitos no domínio
  if (/[^\w\-.]/.test(parsedUrl.hostname)) {
    warnings.push(tr('api.url.unusualChars', lang));
  }
  
  // Verificar subdomínios excessivos
  const subdomains = parsedUrl.hostname.split('.').length - 2;
  if (subdomains > 3) {
    warnings.push(tr('api.url.tooManySubdomains', lang));
  }
  
  return {
    safe: warnings.length === 0,
    warnings,
    details: { https, suspiciousTLD, ipAddress },
  };
}

/**
 * Obtém estatísticas da API
 */
export async function getApiStats(): Promise<ApiStats> {
  const response = await fetch(`${API_BASE_URL}/api/v1/breaches/stats`);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  return response.json();
}
