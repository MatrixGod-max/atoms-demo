"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CONNECTORS } from "@/lib/connectorRegistry";

export default function SettingsForm({
  name,
  email,
  username,
  isDemo,
  credentials,
}: {
  name: string;
  email: string | null;
  username: string | null;
  isDemo: boolean;
  credentials: { connector: string; masked: string }[];
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

  const [credDrafts, setCredDrafts] = useState<Record<string, string>>({});
  const [credBusy, setCredBusy] = useState("");
  const [credMsg, setCredMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  const saveCredential = async (connector: string) => {
    const secret = (credDrafts[connector] ?? "").trim();
    if (!secret || credBusy) return;
    setCredBusy(connector);
    setCredMsg(null);
    const res = await fetch("/api/user/connectors", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connector, secret }),
    });
    const d = await res.json().catch(() => ({}));
    setCredMsg(res.ok ? { id: connector, ok: true, text: "已保存" } : { id: connector, ok: false, text: d.error ?? "保存失败" });
    setCredBusy("");
    if (res.ok) {
      setCredDrafts((c) => ({ ...c, [connector]: "" }));
      router.refresh();
    }
  };

  const clearCredential = async (connector: string) => {
    if (credBusy) return;
    setCredBusy(connector);
    setCredMsg(null);
    const res = await fetch("/api/user/connectors", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connector }),
    });
    setCredMsg(res.ok ? { id: connector, ok: true, text: "已清除" } : { id: connector, ok: false, text: "清除失败" });
    setCredBusy("");
    if (res.ok) router.refresh();
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
        <div className="card p-4 text-xs text-muted">
          演示账号已开放全部功能;因账号为评审共享,仅不支持修改密码。
        </div>
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
          onChange={(e) => setNewName(e.target.value)}
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            className="btn-primary px-4 py-2 text-sm"
            disabled={savingName || !newName.trim() || newName.trim() === name}
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

      <section className="card p-5">
        <h2 className="font-semibold text-sm mb-1">连接器凭证</h2>
        <p className="text-xs text-muted mb-4">
          凭证仅用于你自己工作台预览中的连接器调用,发布的应用不会携带;天气/汇率/二维码/Google Drive 免凭证。
          {isDemo && <span className="text-amber"> 注意:演示账号为共享账号,这里保存的令牌对所有评审可见共用。</span>}
        </p>
        <div className="flex flex-col gap-4">
          {CONNECTORS.filter((c) => c.kind === "token").map((c) => {
            const saved = credentials.find((r) => r.connector === c.id);
            return (
              <div key={c.id} className="border border-line rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span>{c.icon}</span>
                  <span className="font-medium">{c.credential!.label}</span>
                  {saved ? (
                    <span className="ml-auto text-xs font-mono text-good">{saved.masked}</span>
                  ) : (
                    <span className="ml-auto text-xs text-muted">未配置</span>
                  )}
                </div>
                <p className="text-[11px] text-muted mt-1">{c.credential!.help}</p>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="password"
                    className="input flex-1 px-2.5 py-1.5 text-xs"
                    placeholder={c.credential!.placeholder}
                    value={credDrafts[c.id] ?? ""}
                    onChange={(e) => setCredDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="btn-primary px-3 py-1.5 text-xs shrink-0"
                    disabled={credBusy === c.id || !(credDrafts[c.id] ?? "").trim()}
                    onClick={() => saveCredential(c.id)}
                  >
                    {saved ? "更换" : "保存"}
                  </button>
                  {saved && (
                    <button
                      type="button"
                      className="btn-ghost px-2.5 py-1.5 text-xs text-muted hover:text-bad shrink-0"
                      disabled={credBusy === c.id}
                      onClick={() => clearCredential(c.id)}
                    >
                      清除
                    </button>
                  )}
                </div>
                {credMsg?.id === c.id && (
                  <p className={`text-xs mt-1.5 ${credMsg.ok ? "text-good" : "text-bad"}`}>{credMsg.text}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
