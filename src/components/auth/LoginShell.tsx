import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Shield, Users } from "lucide-react";
import crssMark from "@/assets/crss-mark.svg";
import "./loginShell.css";

const STAGES = ["Заявка", "Закупка", "Логистика", "Поставка"];

export function CrssLogo() {
  return (
    <span className="crss-logo" role="img" aria-label="CRSS CRM">
      <img src={crssMark} alt="" className="crss-logo__mark" />
      <span className="crss-logo__word">CRSS<span className="crss-logo__sub">CRM</span></span>
    </span>
  );
}

interface LoginShellProps {
  role: "admin" | "employee";
  title?: string;
  lead?: string;
  showRoleSwitch?: boolean;
  children: ReactNode;
}

/** Общий фирменный каркас входа, регистрации и восстановления. */
export default function LoginShell({
  role,
  title = "Вход",
  lead,
  showRoleSwitch = true,
  children,
}: LoginShellProps) {
  return (
    <div className="crss-login">
      <aside className="crss-login__aside">
        <div className="crss-login__hero">
          <div className="crss-login__hero-logo"><CrssLogo /></div>
          <p className="crss-login__hero-title">От заявки<br />до поставки.</p>
          <ol className="crss-stages">
            {STAGES.map((stage) => (
              <li key={stage}><span className="crss-stages__dot" />{stage}</li>
            ))}
          </ol>
        </div>
      </aside>

      <main className="crss-login__main">
        <div className="crss-login__form">
          <div>
            <h1 className="crss-login__title">{title}</h1>
            {lead && <p className="crss-login__lead">{lead}</p>}
          </div>
          {showRoleSwitch && (
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
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
