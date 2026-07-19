"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SettingsForm({
  name,
  email,
  username,
  isDemo,
}: {
  name: string;
  email: string | null;
  username: string | null;
  isDemo: boolean;
}) {
  const router = useRouter();
  const [newName, setNewName] = useState(name);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  const patch = async (body: object) => {
    const res = await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    return { ok: res.ok, error: d.error as string | undefined };
  };

  const saveName = async () => {
    if (savingName) return;
    setSavingName(true);
    setNameMsg(null);
    const r = await patch({ name: newName });
    setNameMsg(r.ok ? { ok: true, text: "已保存" } : { ok: false, text: r.error ?? "保存失败" });
    setSavingName(false);
    if (r.ok) router.refresh();
  };

  const savePassword = async () => {
    if (savingPw) return;
    setSavingPw(true);
    setPwMsg(null);
    const r = await patch({ currentPassword, newPassword });
    if (r.ok) {
      setPwMsg({ ok: true, text: "密码已更新" });
      setCurrentPassword("");
      setNewPassword("");
    } else {
      setPwMsg({ ok: false, text: r.error ?? "修改失败" });
    }
    setSavingPw(false);
  };

  return (
    <div className="flex flex-col gap-5">
      {isDemo && (
        <div className="card p-4 text-xs text-muted">演示账号只读,注册即可体验完整功能。</div>
      )}

      <section className="card p-5">
        <h2 className="font-semibold text-sm mb-4">基本信息</h2>
        <label className="block text-xs text-muted mb-1">用户名</label>
        <input className="input w-full px-3 py-2 text-sm mb-3 opacity-60" value={username ?? "未设置"} disabled />
        <label className="block text-xs text-muted mb-1">邮箱</label>
        <input className="input w-full px-3 py-2 text-sm mb-3 opacity-60" value={email ?? "未绑定"} disabled />
        <label className="block text-xs text-muted mb-1">名称</label>
        <input
          className="input w-full px-3 py-2 text-sm"
          value={newName}
          maxLength={40}
          disabled={isDemo}
          onChange={(e) => setNewName(e.target.value)}
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            className="btn-primary px-4 py-2 text-sm"
            disabled={isDemo || savingName || !newName.trim() || newName.trim() === name}
            onClick={saveName}
          >
            {savingName ? "保存中…" : "保存"}
          </button>
          {nameMsg && <span className={`text-xs ${nameMsg.ok ? "text-good" : "text-bad"}`}>{nameMsg.text}</span>}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold text-sm mb-4">修改密码</h2>
        <label className="block text-xs text-muted mb-1">当前密码</label>
        <input
          type="password"
          className="input w-full px-3 py-2 text-sm mb-3"
          value={currentPassword}
          disabled={isDemo}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <label className="block text-xs text-muted mb-1">新密码</label>
        <input
          type="password"
          className="input w-full px-3 py-2 text-sm"
          placeholder="至少 10 位,包含字母和数字"
          value={newPassword}
          disabled={isDemo}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            className="btn-primary px-4 py-2 text-sm"
            disabled={isDemo || savingPw || !currentPassword || !newPassword}
            onClick={savePassword}
          >
            {savingPw ? "提交中…" : "更新密码"}
          </button>
          {pwMsg && <span className={`text-xs ${pwMsg.ok ? "text-good" : "text-bad"}`}>{pwMsg.text}</span>}
        </div>
      </section>
    </div>
  );
}
