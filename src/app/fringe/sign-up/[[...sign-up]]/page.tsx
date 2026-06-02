import { SignUp } from "@clerk/nextjs";

export default function FringeSignUpPage() {
  return (
    <div className="auth-page">
      <SignUp
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
