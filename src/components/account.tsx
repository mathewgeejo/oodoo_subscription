"use client";
import { useState, type FormEvent } from "react";
import { useUser } from "./session";
import { api } from "./api";
import { Status } from "./data";
export function Account() {
  const user = useUser();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function submit(
    event: FormEvent<HTMLFormElement>,
    action: "profile" | "password" | "staff",
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(action);
    setError("");
    setSuccess("");
    try {
      if (action === "profile") {
        await api("/api/auth/update-user", {
          method: "POST",
          body: JSON.stringify({ name: fields.get("name") }),
        });
        location.reload();
      }
      if (action === "password") {
        if (fields.get("newPassword") !== fields.get("confirm"))
          throw Error("The new passwords don't match.");
        await api("/api/auth/change-password", {
          method: "POST",
          body: JSON.stringify({
            currentPassword: fields.get("currentPassword"),
            newPassword: fields.get("newPassword"),
            revokeOtherSessions: true,
          }),
        });
        form.reset();
        setSuccess(
          "Password changed. Your other sessions have been signed out.",
        );
      }
      if (action === "staff") {
        await api("/api/v1/staff", {
          method: "POST",
          body: JSON.stringify({
            name: fields.get("name"),
            email: fields.get("email"),
            password: fields.get("password"),
          }),
        });
        form.reset();
        setSuccess("Staff account created.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR SPACE, YOUR SETTINGS</span>
          <h1>My account</h1>
          <p>Keep your profile up to date and your account secure.</p>
        </div>
        <Status value={user.role} />
      </div>
      {error && (
        <div role="alert" className="notice notice-error">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="notice notice-success">
          {success}
        </div>
      )}
      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Profile details</h2>
              <p>A familiar face in your workspace.</p>
            </div>
          </div>
          <form className="form-panel" onSubmit={(e) => submit(e, "profile")}>
            <label>
              Full name
              <input
                name="name"
                required
                defaultValue={user.name}
                maxLength={100}
                autoComplete="name"
              />
            </label>
            <label>
              Email address
              <input type="email" value={user.email} readOnly />
              <small>Your sign-in address.</small>
            </label>
            <button className="button button-primary" disabled={!!busy}>
              Save changes
            </button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Change password</h2>
              <p>A little peace of mind.</p>
            </div>
          </div>
          <form className="form-panel" onSubmit={(e) => submit(e, "password")}>
            <label>
              Current password
              <input
                type="password"
                name="currentPassword"
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              New password
              <input
                type="password"
                name="newPassword"
                autoComplete="new-password"
                required
                minLength={9}
                maxLength={128}
              />
              <small>
                9+ characters with uppercase, lowercase, and a special
                character.
              </small>
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                name="confirm"
                autoComplete="new-password"
                required
                minLength={9}
              />
            </label>
            <button className="button" disabled={!!busy}>
              Update password
            </button>
          </form>
        </section>
      </div>
      {user.role === "ADMIN" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
                <h2>Add a teammate</h2>
              <p>Create a staff account for your internal team.</p>
            </div>
          </div>
          <form className="form-panel" onSubmit={(e) => submit(e, "staff")}>
            <label>
              Team member name
              <input name="name" required maxLength={100} />
            </label>
            <label>
              Team member email
              <input name="email" type="email" required autoComplete="off" />
            </label>
            <label>
              Initial password
              <input
                name="password"
                type="password"
                minLength={9}
                maxLength={128}
                required
                autoComplete="new-password"
              />
              <small>
                Use 9+ characters, uppercase, lowercase and a special character.
                Share credentials securely.
              </small>
            </label>
            <button className="button button-primary" disabled={!!busy}>
              Create staff account
            </button>
          </form>
        </section>
      )}
    </>
  );
}
