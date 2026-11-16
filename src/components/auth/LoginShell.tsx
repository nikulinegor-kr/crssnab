import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Sun, Moon, Shield, Users } from "lucide-react";
import { useTheme } from "next-themes";
import crssMark from "@/assets/crss-mark.svg";
import "./loginShell.css";

const STAGES = ["Заявка", "Закупка", "Логистика", "Поставка"];

function Logo() {
  return (
    <span className="crss-logo" aria-label="CRSS CRM">
      <img src={crssMark} alt="" className="crss-logo__mark" />
      <span className="crss-logo__word">CRSS<span className="crss-logo__sub">CRM</span></span>
    </span>
  );
}

interface LoginShellProps {
  role: "admin" | "employee";
  lead: string;
  children: ReactNode;
}

/** Shared visual frame for the admin and employee login screens. */
export default function LoginShell({ role, lead, children }: LoginShellProps) {
  const { theme, setTheme } = useTheme();
  return (
    <div className="crss-login">
      <aside className="crss-login__aside">
        <div className="crss-login__aside-logo"><Logo /></div>
        <div className="crss-login__hero">
          <img src={crssMark} alt="" className="crss-login__hero-mark" />
          <h1 className="crss-login__hero-title">От заявки<br />до поставки.</h1>
          <ol className="crss-stages">
            {STAGES.map((s) => (
              <li key={s}><span className="crss-stages__dot" />{s}</li>
            ))}
          </ol>
        </div>
      </aside>

      <main className="crss-login__main">
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="crss-login__theme"
          aria-label="Переключить тему"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <div className="crss-login__mobile-head"><Logo /></div>

        <div className="crss-login__form">
          <div>
            <h2 className="crss-login__title">Вход в CRSS</h2>
            <p className="crss-login__lead">{lead}</p>
          </div>
          <nav className="crss-switch" aria-label="Роль">
            {role === "admin" ? (
              <span aria-current="page"><Shield className="h-4 w-4" />Администратор</span>
            ) : (
              <Link to="/"><Shield className="h-4 w-4" />Администратор</Link>
            )}
            {role === "employee" ? (
              <span aria-current="page"><Users className="h-4 w-4" />Сотрудник</span>
            ) : (
              <Link to="/employee-login"><Users className="h-4 w-4" />Сотрудник</Link>
            )}
          </nav>
          {children}
        </div>
      </main>
    </div>
  );
}
