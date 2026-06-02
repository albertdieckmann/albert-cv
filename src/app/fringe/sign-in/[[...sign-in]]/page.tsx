import { SignIn } from "@clerk/nextjs";

export default function FringeSignInPage() {
  return (
    <div className="auth-page">
      <SignIn
        fallbackRedirectUrl="/fringe"
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
