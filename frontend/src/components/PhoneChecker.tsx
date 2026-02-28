'use client';

import { useState, useMemo } from 'react';
import Select, { SingleValue, StylesConfig, OptionProps, SingleValueProps, components } from 'react-select';
import { checkPhoneBreach, BreachInfo, COUNTRY_CODES, CountryCode } from '@/lib/api';
import BreachResults from './BreachResults';
import { useLanguage } from '@/contexts/LanguageContext';

// Tipo para as opções do react-select
interface CountryOption {
  value: string;
  label: string;
  country: CountryCode;
  localizedName: string;
}

// Mapear código de telefone para código ISO do país
const phoneToISO: Record<string, string> = {
  // A
  '+93': 'AF', '+27': 'ZA', '+355': 'AL', '+49': 'DE', '+376': 'AD',
  '+244': 'AO', '+1264': 'AI', '+1268': 'AG', '+966': 'SA', '+213': 'DZ',
  '+54': 'AR', '+374': 'AM', '+297': 'AW', '+61': 'AU', '+43': 'AT',
  '+994': 'AZ',
  // B
  '+1242': 'BS', '+880': 'BD', '+1246': 'BB', '+973': 'BH', '+32': 'BE',
  '+501': 'BZ', '+229': 'BJ', '+1441': 'BM', '+375': 'BY', '+591': 'BO',
  '+387': 'BA', '+267': 'BW', '+55': 'BR', '+673': 'BN', '+359': 'BG',
  '+226': 'BF', '+257': 'BI',
  // C
  '+238': 'CV', '+237': 'CM', '+855': 'KH', '+1': 'US', '+974': 'QA',
  '+7': 'RU', '+235': 'TD', '+56': 'CL', '+86': 'CN', '+357': 'CY',
  '+57': 'CO', '+269': 'KM', '+242': 'CG', '+850': 'KP', '+82': 'KR',
  '+225': 'CI', '+506': 'CR', '+385': 'HR', '+53': 'CU', '+599': 'CW',
  // D
  '+45': 'DK', '+253': 'DJ', '+1767': 'DM',
  // E
  '+20': 'EG', '+503': 'SV', '+971': 'AE', '+593': 'EC', '+291': 'ER',
  '+421': 'SK', '+386': 'SI', '+34': 'ES', '+372': 'EE', '+251': 'ET',
  // F
  '+679': 'FJ', '+63': 'PH', '+358': 'FI', '+33': 'FR',
  // G
  '+241': 'GA', '+220': 'GM', '+233': 'GH', '+995': 'GE', '+350': 'GI',
  '+1473': 'GD', '+30': 'GR', '+299': 'GL', '+590': 'GP', '+1671': 'GU',
  '+502': 'GT', '+592': 'GY', '+594': 'GF', '+224': 'GN', '+240': 'GQ',
  '+245': 'GW',
  // H
  '+509': 'HT', '+504': 'HN', '+852': 'HK', '+36': 'HU',
  // I
  '+967': 'YE', '+1345': 'KY', '+682': 'CK', '+298': 'FO', '+500': 'FK',
  '+692': 'MH', '+677': 'SB', '+1284': 'VG', '+1340': 'VI', '+91': 'IN',
  '+62': 'ID', '+98': 'IR', '+964': 'IQ', '+353': 'IE', '+354': 'IS',
  '+972': 'IL', '+39': 'IT',
  // J
  '+1876': 'JM', '+81': 'JP', '+962': 'JO',
  // K
  '+254': 'KE', '+996': 'KG', '+686': 'KI',
  // L
  '+856': 'LA', '+266': 'LS', '+371': 'LV', '+961': 'LB', '+231': 'LR',
  '+218': 'LY', '+423': 'LI', '+370': 'LT', '+352': 'LU',
  // M
  '+853': 'MO', '+389': 'MK', '+261': 'MG', '+60': 'MY', '+265': 'MW',
  '+960': 'MV', '+223': 'ML', '+356': 'MT', '+212': 'MA', '+596': 'MQ',
  '+230': 'MU', '+222': 'MR', '+52': 'MX', '+95': 'MM', '+691': 'FM',
  '+258': 'MZ', '+373': 'MD', '+377': 'MC', '+976': 'MN', '+382': 'ME',
  '+1664': 'MS',
  // N
  '+264': 'NA', '+674': 'NR', '+977': 'NP', '+505': 'NI', '+227': 'NE',
  '+234': 'NG', '+683': 'NU', '+47': 'NO', '+687': 'NC', '+64': 'NZ',
  // O
  '+968': 'OM',
  // P
  '+31': 'NL', '+680': 'PW', '+970': 'PS', '+507': 'PA', '+675': 'PG',
  '+92': 'PK', '+595': 'PY', '+51': 'PE', '+689': 'PF', '+48': 'PL',
  '+1787': 'PR', '+351': 'PT',
  // R
  '+44': 'GB', '+236': 'CF', '+420': 'CZ', '+243': 'CD', '+1809': 'DO',
  '+262': 'RE', '+40': 'RO', '+250': 'RW',
  // S
  '+685': 'WS', '+1684': 'AS', '+290': 'SH', '+1758': 'LC', '+1869': 'KN',
  '+378': 'SM', '+508': 'PM', '+239': 'ST', '+1784': 'VC', '+221': 'SN',
  '+232': 'SL', '+381': 'RS', '+248': 'SC', '+65': 'SG', '+1721': 'SX',
  '+963': 'SY', '+252': 'SO', '+94': 'LK', '+268': 'SZ', '+249': 'SD',
  '+211': 'SS', '+46': 'SE', '+41': 'CH', '+597': 'SR',
  // T
  '+66': 'TH', '+886': 'TW', '+992': 'TJ', '+255': 'TZ', '+670': 'TL',
  '+228': 'TG', '+676': 'TO', '+1868': 'TT', '+216': 'TN', '+993': 'TM',
  '+90': 'TR', '+688': 'TV',
  // U
  '+380': 'UA', '+256': 'UG', '+598': 'UY', '+998': 'UZ',
  // V
  '+678': 'VU', '+379': 'VA', '+58': 'VE', '+84': 'VN',
  // Z
  '+260': 'ZM', '+263': 'ZW',
};

// Obter nome do país localizado com Intl.DisplayNames
function getLocalizedCountryName(phoneCode: string, fallbackName: string, locale: string): string {
  const iso = phoneToISO[phoneCode];
  if (!iso) return fallbackName;
  try {
    const displayNames = new Intl.DisplayNames([locale], { type: 'region' });
    return displayNames.of(iso) || fallbackName;
  } catch {
    return fallbackName;
  }
}

// Função para obter URL da bandeira via flagcdn.com
const getFlagUrl = (countryCode: string): string => {
  const iso = phoneToISO[countryCode]?.toLowerCase() || 'un';
  return `https://flagcdn.com/24x18/${iso}.png`;
};

// Componente personalizado para mostrar a opção
// Formato: 🇵🇹 Portugal +351
const CountryOptionComponent = (props: OptionProps<CountryOption>) => {
  const { data } = props;
  return (
    <components.Option {...props}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img 
          src={getFlagUrl(data.country.code)} 
          alt={data.localizedName}
          style={{ width: '24px', height: '18px', objectFit: 'cover', borderRadius: '2px' }}
        />
        <span style={{ flex: 1 }}>{data.localizedName}</span>
        <span style={{ color: '#888' }}>{data.country.code}</span>
      </div>
    </components.Option>
  );
};

// Componente personalizado para mostrar o valor selecionado
const CountrySingleValue = (props: SingleValueProps<CountryOption>) => {
  const { data } = props;
  return (
    <components.SingleValue {...props}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img 
          src={getFlagUrl(data.country.code)} 
          alt={data.country.name}
          style={{ width: '20px', height: '15px', objectFit: 'cover', borderRadius: '2px' }}
        />
        <span>{data.country.code}</span>
      </div>
    </components.SingleValue>
  );
};

// Estilos personalizados para o react-select
const customStyles: StylesConfig<CountryOption, false> = {
  control: (base, state) => ({
    ...base,
    backgroundColor: '#161b22',
    borderColor: state.isFocused ? 'var(--primary)' : 'var(--border)',
    borderRadius: '12px 0 0 12px',
    minHeight: '50px',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(16, 185, 129, 0.2)' : 'none',
    cursor: 'pointer',
    '&:hover': {
      borderColor: 'var(--primary)',
    },
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: '#161b22',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
    zIndex: 100,
    overflow: 'hidden',
    minWidth: '300px',
  }),
  menuList: (base) => ({
    ...base,
    padding: '8px',
    maxHeight: '300px',
    overflowX: 'hidden',
    '::-webkit-scrollbar': {
      width: '8px',
    },
    '::-webkit-scrollbar-track': {
      background: '#0d1117',
    },
    '::-webkit-scrollbar-thumb': {
      background: '#30363d',
      borderRadius: '4px',
    },
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected 
      ? 'var(--primary)' 
      : state.isFocused 
        ? 'rgba(16, 185, 129, 0.15)' 
        : '#161b22',
    color: state.isSelected ? 'white' : 'var(--text)',
    padding: '12px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    marginBottom: '4px',
    '&:active': {
      backgroundColor: 'var(--primary)',
    },
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--text)',
  }),
  input: (base) => ({
    ...base,
    color: 'var(--text)',
  }),
  placeholder: (base) => ({
    ...base,
    color: 'var(--gray)',
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
  dropdownIndicator: (base) => ({
    ...base,
    color: 'var(--gray)',
    '&:hover': {
      color: 'var(--primary)',
    },
  }),
};

export default function PhoneChecker() {
  const [phone, setPhone] = useState('');
  const { t, lang } = useLanguage();
  
  // Nenhum país selecionado por defeito
  const [selectedCountry, setSelectedCountry] = useState<CountryCode | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    found: boolean;
    breaches: BreachInfo[];
    searched: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Converter COUNTRY_CODES para formato do react-select
  // Nomes traduzidos automaticamente com Intl.DisplayNames
  const countryOptions: CountryOption[] = useMemo(() => {
    const locale = lang === 'pt' ? 'pt' : 'en';
    return [...COUNTRY_CODES]
      .map(country => {
        const localizedName = getLocalizedCountryName(country.code, country.name, locale);
        return {
          value: country.code,
          label: `${localizedName} ${country.code}`,
          country: country,
          localizedName,
        };
      })
      .sort((a, b) => a.localizedName.localeCompare(b.localizedName, locale));
  }, [lang]);

  // Encontrar a opção selecionada (pode ser null)
  const selectedOption = useMemo(() => {
    if (!selectedCountry) return null;
    return countryOptions.find(opt => opt.value === selectedCountry.code) || null;
  }, [countryOptions, selectedCountry]);

  // Validar se o input contém apenas números
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setPhone(value);
  };

  // Handler para mudança de país
  const handleCountryChange = (option: SingleValue<CountryOption>) => {
    if (option) {
      setSelectedCountry(option.country);
      setPhone('');
    }
  };

  // Verificar se o número tem o comprimento correto
  const isValidLength = selectedCountry 
    ? phone.length >= selectedCountry.minDigits && phone.length <= selectedCountry.maxDigits
    : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone.trim() || !isValidLength || !selectedCountry) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const data = await checkPhoneBreach(phone, selectedCountry.code);
      setResult({
        found: data.found,
        breaches: data.breaches,
        searched: true,
      });
    } catch (err) {
      console.error('Error checking phone:', err);
      setError(t('phone.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <div className="phone-input-group">
          {/* Seletor de País com react-select */}
          <div className="country-select-container">
            <Select<CountryOption>
              options={countryOptions}
              value={selectedOption}
              onChange={handleCountryChange}
              styles={customStyles}
              components={{
                Option: CountryOptionComponent,
                SingleValue: CountrySingleValue,
              }}
              isSearchable={true}
              placeholder={t('phone.country')}
              noOptionsMessage={() => t('phone.noCountry')}
              hideSelectedOptions={true}
              closeMenuOnSelect={true}
              blurInputOnSelect={true}
              filterOption={(option, inputValue) => {
                if (!inputValue) return true;
                const searchLower = inputValue.toLowerCase();
                return (
                  option.data.country.name.toLowerCase().includes(searchLower) ||
                  option.data.country.code.includes(inputValue)
                );
              }}
            />
          </div>
          
          {/* Input do Número */}
          <input
            type="tel"
            className="phone-input"
            placeholder={selectedCountry ? `${selectedCountry.minDigits} ${t('phone.digits')}` : t('phone.selectCountry')}
            value={phone}
            onChange={handlePhoneChange}
            maxLength={selectedCountry?.maxDigits || 15}
            disabled={!selectedCountry}
          />
        </div>
        
        {/* Indicador de validação */}
        <div className="phone-validation">
          <span className={`validation-text ${phone.length > 0 && selectedCountry ? (isValidLength ? 'valid' : 'invalid') : ''}`}>
            {phone.length > 0 && selectedCountry && (
              <>
                {isValidLength ? '✓' : '✗'} {phone.length}/{selectedCountry.minDigits === selectedCountry.maxDigits 
                  ? selectedCountry.minDigits 
                  : `${selectedCountry.minDigits}-${selectedCountry.maxDigits}`} {t('phone.digits')}
              </>
            )}
          </span>
          <span className="country-name">{selectedCountry?.name || t('phone.noCountrySelected')}</span>
        </div>
        
        <button 
          type="submit" 
          className="btn" 
          disabled={loading || !phone.trim() || !isValidLength || !selectedCountry}
        >
          {loading ? t('phone.checking') : t('phone.check')}
        </button>
      </form>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <span>{t('phone.searching')}</span>
        </div>
      )}

      {error && (
        <div className="result-container">
          <p style={{ color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {result && result.searched && !loading && (
        <BreachResults 
          found={result.found} 
          breaches={result.breaches} 
          type="phone"
        />
      )}
    </div>
  );
}
