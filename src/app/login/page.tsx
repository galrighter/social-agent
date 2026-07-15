import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="poker-container flex min-h-screen items-center justify-center">
      <LoginClient />
    </div>
  );
}
