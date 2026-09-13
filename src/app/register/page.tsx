import AuthBar from "@/components/AuthBar";
import RegisterForm from "./RegisterForm";
import { getTheme } from "@/lib/prefs";

export default async function RegisterPage() {
  const theme = await getTheme();
  return (
    <div className="authwrap">
      <div className="authcard" style={{ maxWidth: 520 }}>
        <AuthBar theme={theme} />
        <RegisterForm />
      </div>
    </div>
  );
}
