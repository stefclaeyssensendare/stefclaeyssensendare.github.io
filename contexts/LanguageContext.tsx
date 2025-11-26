import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

const STORAGE_KEY = "selectedLanguage";

type Language = "NL" | "FR";

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(
  undefined
);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>("NL");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedLang = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (storedLang === "NL" || storedLang === "FR") {
        setLanguageState(storedLang);
      }
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
