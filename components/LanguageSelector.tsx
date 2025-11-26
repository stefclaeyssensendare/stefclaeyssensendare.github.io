import { useLanguage } from "../contexts/LanguageContext";

const LANGUAGES = [
  { code: "NL", label: "NL" },
  { code: "FR", label: "FR" },
];

const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage(); // use context

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = event.target.value as "NL" | "FR";
    setLanguage(lang); // update context and localStorage
  };

  return (
    <div className="w-max">
      <select
        value={language} // use context value
        onChange={handleChange}
        className="language-select"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;
