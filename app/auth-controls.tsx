"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn, signOut, useSession } from "next-auth/react";

type OAuthProvider = {
  id: string;
  name: string;
};

export default function AuthControls() {
  const { data: session, status } = useSession();
  const [providers, setProviders] = useState<OAuthProvider[]>([]);

  useEffect(() => {
    getProviders().then((result) => {
      if (!result) return;
      const list = Object.values(result)
        .filter((provider) => provider.type === "oauth")
        .map((provider) => ({ id: provider.id, name: provider.name }));
      setProviders(list);
    });
  }, []);

  if (status === "loading") {
    return <span className="authStatus">Loading...</span>;
  }

  if (session?.user?.email) {
    return (
      <div className="authGroup">
        <span className="authStatus">{session.user.name ?? session.user.email}</span>
        <button type="button" className="authBtn authBtnGhost" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  if (providers.length === 0) {
    return <span className="authStatus">Set Google/Apple env vars to enable sign-in</span>;
  }

  return (
    <div className="authGroup">
      {providers.map((provider) => (
        <button key={provider.id} type="button" className="authBtn" onClick={() => signIn(provider.id)}>
          Continue with {provider.name}
        </button>
      ))}
    </div>
  );
}
