import React, { useEffect, useState } from "react";
import { api } from "./api";
import { Dialog } from "./main";
export function AccountActivation() {
  const [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <main className="login-page">
      <img
        src="./assets/logo-falmouth-after-5-blue.svg"
        width="180"
        alt="Falmouth After Five"
      />
      <form
        className="login-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const password = new FormData(e.currentTarget).get("password");
          setBusy(true);
          try {
            await api("session");
            await api("activate-account", {
              token: new URLSearchParams(location.search).get("activate"),
              password,
            });
            history.replaceState(null, "", "?admin");
            setDone(true);
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1>{done ? "Account ready" : "Set your password"}</h1>
        {done ? (
          <a className="button primary" href="?admin">
            Sign in
          </a>
        ) : (
          <>
            <p>
              Choose a password of at least 12 characters to activate your
              account or reset access.
            </p>
            <label className="field">
              New password
              <input
                type="password"
                name="password"
                minLength={12}
                maxLength={200}
                required
                autoComplete="new-password"
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? "Saving…" : "Save password"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
export default function AdminUsers({ onClose }) {
  const [users, setUsers] = useState([]),
    [error, setError] = useState(""),
    [link, setLink] = useState(""),
    [confirm, setConfirm] = useState(null),
    [busy, setBusy] = useState(false);
  const load = () =>
    api("users")
      .then((d) => setUsers(d.users))
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const act = async (action, input) => {
    setBusy(true);
    setError("");
    try {
      const d = await api(action, input);
      setLink(
        d.token
          ? `${location.origin}${location.pathname}?admin&activate=${d.token}`
          : "",
      );
      setConfirm(null);
      await load();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog label="Manage staff users" onClose={onClose} wide>
      <div className="detail-body">
        <h2>Staff users</h2>
        <p>
          Invite individual admins. Each person sets their own password using a
          single-use link, valid for 24 hours.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {link && (
          <section className="notice">
            <strong>
              Share this private account link with the intended person
            </strong>
            <p>
              No email has been sent. Creating another link invalidates the
              previous one.
            </p>
            <input
              aria-label="Account setup link"
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
              style={{ width: "100%" }}
            />
          </section>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            if (
              await act("invite-user", Object.fromEntries(new FormData(form)))
            )
              form.reset();
          }}
        >
          <div className="form-grid">
            <label className="field">
              Full name
              <input name="name" required maxLength={120} />
            </label>
            <label className="field">
              Email
              <input name="email" type="email" required maxLength={254} />
            </label>
          </div>
          <button className="button primary" disabled={busy}>
            Create invitation
          </button>
        </form>
        <div className="staff-users">
          {users.map((u) => (
            <article key={u.id}>
              <div>
                <strong>{u.name}</strong>
                <p>
                  {u.email} · {u.role} ·{" "}
                  {u.active ? "Active" : "Inactive / awaiting activation"}
                </p>
              </div>
              {u.role !== "super-admin" && (
                <div className="editor-actions">
                  <button
                    className="button secondary small"
                    disabled={busy}
                    onClick={() =>
                      setConfirm({
                        action: "reset-user",
                        id: u.id,
                        name: u.name,
                      })
                    }
                  >
                    Reset / activate access
                  </button>
                  <button
                    className="text-link"
                    disabled={busy || !u.active}
                    onClick={() =>
                      setConfirm({
                        action: "disable-user",
                        id: u.id,
                        name: u.name,
                      })
                    }
                  >
                    Disable account
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
        {confirm && (
          <Dialog
            label="Confirm account change"
            onClose={() => setConfirm(null)}
          >
            <div className="detail-body">
              <h2>
                {confirm.action === "disable-user"
                  ? "Disable account?"
                  : "Create a new access link?"}
              </h2>
              <p>
                {confirm.name}:{" "}
                {confirm.action === "disable-user"
                  ? "This ends their active sessions and prevents sign-in."
                  : "Any previous setup link will stop working. Their password changes only when they use the new link."}
              </p>
              <div className="editor-actions">
                <button
                  className="button secondary"
                  onClick={() => setConfirm(null)}
                >
                  Cancel
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => act(confirm.action, { id: confirm.id })}
                >
                  Confirm
                </button>
              </div>
            </div>
          </Dialog>
        )}
      </div>
    </Dialog>
  );
}
