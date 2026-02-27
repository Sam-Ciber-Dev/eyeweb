'use client';

import { useState, useMemo } from 'react';
import Select, { SingleValue, StylesConfig, OptionProps, SingleValueProps, components } from 'react-select';
import { checkPhoneBreach, BreachInfo, COUNTRY_CODES, CountryCode } from '@/lib/api';
import BreachResults from './BreachResults';

// Tipo para as opções do react-select
interface CountryOption {
  value: string;
  label: string;
  country: CountryCode;
}

// Função para obter URL da bandeira via flagcdn.com
const getFlagUrl = (countryCode: string): string => {
  // Mapear código de telefone para código ISO do país
  const codeToISO: Record<string, string> = {
    // A
    '+93': 'af', '+27': 'za', '+355': 'al', '+49': 'de', '+376': 'ad',
    '+244': 'ao', '+1264': 'ai', '+1268': 'ag', '+966': 'sa', '+213': 'dz',
    '+54': 'ar', '+374': 'am', '+297': 'aw', '+61': 'au', '+43': 'at',
    '+994': 'az',
    // B
    '+1242': 'bs', '+880': 'bd', '+1246': 'bb', '+973': 'bh', '+32': 'be',
    '+501': 'bz', '+229': 'bj', '+1441': 'bm', '+375': 'by', '+591': 'bo',
    '+387': 'ba', '+267': 'bw', '+55': 'br', '+673': 'bn', '+359': 'bg',
    '+226': 'bf', '+257': 'bi',
    // C
    '+238': 'cv', '+237': 'cm', '+855': 'kh', '+1': 'us', '+974': 'qa',
    '+7': 'ru', '+235': 'td', '+56': 'cl', '+86': 'cn', '+357': 'cy',
    '+57': 'co', '+269': 'km', '+242': 'cg', '+850': 'kp', '+82': 'kr',
    '+225': 'ci', '+506': 'cr', '+385': 'hr', '+53': 'cu', '+599': 'cw',
    // D
    '+45': 'dk', '+253': 'dj', '+1767': 'dm',
    // E
    '+20': 'eg', '+503': 'sv', '+971': 'ae', '+593': 'ec', '+291': 'er',
    '+421': 'sk', '+386': 'si', '+34': 'es', '+372': 'ee', '+251': 'et',
    // F
    '+679': 'fj', '+63': 'ph', '+358': 'fi', '+33': 'fr',
    // G
    '+241': 'ga', '+220': 'gm', '+233': 'gh', '+995': 'ge', '+350': 'gi',
    '+1473': 'gd', '+30': 'gr', '+299': 'gl', '+590': 'gp', '+1671': 'gu',
    '+502': 'gt', '+592': 'gy', '+594': 'gf', '+224': 'gn', '+240': 'gq',
    '+245': 'gw',
    // H
    '+509': 'ht', '+504': 'hn', '+852': 'hk', '+36': 'hu',
    // I
    '+967': 'ye', '+1345': 'ky', '+682': 'ck', '+298': 'fo', '+500': 'fk',
    '+692': 'mh', '+677': 'sb', '+1284': 'vg', '+1340': 'vi', '+91': 'in',
    '+62': 'id', '+98': 'ir', '+964': 'iq', '+353': 'ie', '+354': 'is',
    '+972': 'il', '+39': 'it',
    // J
    '+1876': 'jm', '+81': 'jp', '+962': 'jo',
    // L
    '+856': 'la', '+266': 'ls', '+371': 'lv', '+961': 'lb', '+231': 'lr',
    '+218': 'ly', '+423': 'li', '+370': 'lt', '+352': 'lu',
    // M
    '+853': 'mo', '+389': 'mk', '+261': 'mg', '+60': 'my', '+265': 'mw',
    '+960': 'mv', '+223': 'ml', '+356': 'mt', '+212': 'ma', '+596': 'mq',
    '+230': 'mu', '+222': 'mr', '+52': 'mx', '+95': 'mm', '+691': 'fm',
    '+258': 'mz', '+373': 'md', '+377': 'mc', '+976': 'mn', '+382': 'me',
    '+1664': 'ms',
    // N
    '+264': 'na', '+674': 'nr', '+977': 'np', '+505': 'ni', '+227': 'ne',
    '+234': 'ng', '+683': 'nu', '+47': 'no', '+687': 'nc', '+64': 'nz',
    // O
    '+968': 'om',
    // P
    '+31': 'nl', '+680': 'pw', '+970': 'ps', '+507': 'pa', '+675': 'pg',
    '+92': 'pk', '+595': 'py', '+51': 'pe', '+689': 'pf', '+48': 'pl',
    '+1787': 'pr', '+351': 'pt',
    // Q
    '+254': 'ke', '+996': 'kg', '+686': 'ki',
    // R
    '+44': 'gb', '+236': 'cf', '+420': 'cz', '+243': 'cd', '+1809': 'do',
    '+262': 're', '+40': 'ro', '+250': 'rw',
    // S
    '+685': 'ws', '+1684': 'as', '+290': 'sh', '+1758': 'lc', '+1869': 'kn',
    '+378': 'sm', '+508': 'pm', '+239': 'st', '+1784': 'vc', '+221': 'sn',
    '+232': 'sl', '+381': 'rs', '+248': 'sc', '+65': 'sg', '+1721': 'sx',
    '+963': 'sy', '+252': 'so', '+94': 'lk', '+268': 'sz', '+249': 'sd',
    '+211': 'ss', '+46': 'se', '+41': 'ch', '+597': 'sr',
    // T
    '+66': 'th', '+886': 'tw', '+992': 'tj', '+255': 'tz', '+670': 'tl',
    '+228': 'tg', '+676': 'to', '+1868': 'tt', '+216': 'tn', '+993': 'tm',
    '+90': 'tr', '+688': 'tv',
    // U
    '+380': 'ua', '+256': 'ug', '+598': 'uy', '+998': 'uz',
    // V
    '+678': 'vu', '+379': 'va', '+58': 've', '+84': 'vn',
    // Z
    '+260': 'zm', '+263': 'zw',
  };
  
  const iso = codeToISO[countryCode] || 'un';
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
          alt={data.country.name}
          style={{ width: '24px', height: '18px', objectFit: 'cover', borderRadius: '2px' }}
        />
        <span style={{ flex: 1 }}>{data.country.name}</span>
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
  // Ordenar por nome do país (alfabeticamente)
  const countryOptions: CountryOption[] = useMemo(() => 
    [...COUNTRY_CODES]
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
      .map(country => ({
        value: country.code,
        label: `${country.name} ${country.code}`,
        country: country,
      })), []
  );

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
      setError('Erro ao verificar. Tenta novamente mais tarde.');
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
              placeholder="País"
              noOptionsMessage={() => "Nenhum país encontrado"}
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
            placeholder={selectedCountry ? `${selectedCountry.minDigits} dígitos` : 'Seleciona um país'}
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
                  : `${selectedCountry.minDigits}-${selectedCountry.maxDigits}`} dígitos
              </>
            )}
          </span>
          <span className="country-name">{selectedCountry?.name || 'Nenhum país selecionado'}</span>
        </div>
        
        <button 
          type="submit" 
          className="btn" 
          disabled={loading || !phone.trim() || !isValidLength || !selectedCountry}
        >
          {loading ? 'A verificar...' : 'Verificar Número'}
        </button>
      </form>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <span>A procurar em fugas de dados...</span>
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
