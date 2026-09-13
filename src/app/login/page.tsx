import AuthBar from "@/components/AuthBar";
import LoginForm from "./LoginForm";
import { getTheme } from "@/lib/prefs";

export default async function LoginPage() {
  const theme = await getTheme();
  return (
    <div className="authwrap">
      <div className="authcard">
        <AuthBar theme={theme} />
        <LoginForm />
      </div>
    </div>
  );
}
