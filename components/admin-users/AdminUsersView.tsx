"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AdminUsersClientError,
  fetchAdminUsers,
  inviteAdminUser,
} from "@/lib/admin-ui/users-client";
import {
  buildAdminUsersViewModel,
  type AdminUsersDto,
} from "@/lib/admin-ui/users-view-model";

export default function AdminUsersView() {
  const [email, setEmail] = useState("");
  const [users, setUsers] = useState<AdminUsersDto>({ items: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setUsers(await fetchAdminUsers());
    } catch (error: unknown) {
      setErrorMessage(readClientError(error, "Admin listesi alinamadi."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const viewModel = buildAdminUsersViewModel(users);

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsInviting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await inviteAdminUser(email);
      setEmail("");
      setSuccessMessage(`${result.email} icin admin daveti gonderildi.`);
      await loadUsers();
    } catch (error: unknown) {
      setErrorMessage(readClientError(error, "Admin daveti gonderilemedi."));
    } finally {
      setIsInviting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">Adminler</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Operasyon paneline erisecek admin kullanicilari buradan davet edilir.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Admin davet et</CardTitle>
          <CardDescription>
            Davet edilen kisi e-postadaki baglantidan sifresini belirler.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={handleInvite}>
            <div className="grid flex-1 gap-2">
              <Label htmlFor="admin-email">E-posta</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isInviting}>
              <Send className="h-4 w-4" aria-hidden="true" />
              {isInviting ? "Gonderiliyor..." : "Davet gonder"}
            </Button>
          </form>
          {successMessage ? (
            <p className="mt-3 text-sm text-green-600">{successMessage}</p>
          ) : null}
          {errorMessage ? (
            <p className="mt-3 text-sm text-red-500">{errorMessage}</p>
          ) : null}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3" aria-labelledby="admin-users-list">
        <div className="flex items-center justify-between gap-3">
          <h3 id="admin-users-list" className="text-sm font-medium text-muted-foreground">
            Mevcut adminler
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void loadUsers();
            }}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Yenile
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">Yukleniyor...</div>
            ) : viewModel.isEmpty ? (
              <div className="p-6 text-sm text-muted-foreground">
                Henuz admin kullanici bulunmuyor.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">E-posta</th>
                      <th className="px-4 py-3 font-medium">Rol</th>
                      <th className="px-4 py-3 font-medium">Olusturulma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewModel.rows.map((row) => (
                      <tr key={row.id} className="border-b last:border-b-0">
                        <td className="px-4 py-3">{row.email}</td>
                        <td className="px-4 py-3">{row.roleLabel}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.createdAtLabel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function readClientError(error: unknown, fallback: string): string {
  return error instanceof AdminUsersClientError ? error.message : fallback;
}
