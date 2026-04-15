import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="auth-page">
      <SignIn
        appearance={{
          variables: {
            colorPrimary: "#c8f060",
            colorTextOnPrimaryBackground: "#0a0a0a",
            borderRadius: "0px",
          },
        }}
      />
    </div>
  );
}
