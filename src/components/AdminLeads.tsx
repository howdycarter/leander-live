import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Lock } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Mini-CRM (shadcn): lead pipeline board + businesses.                 */
/* Gated by ADMIN_KEY. Route: /admin/leads (SPA fallback serves index.html). */
/* Proper per-user auth (Convex Auth) is the post-hackathon follow-up. */
/* ------------------------------------------------------------------ */

const STAGES = ["new", "contacted", "qualified", "sold", "closed"] as const;
const VERTICALS = [
  "Home Services",
  "Real Estate",
  "Restaurant/Food",
  "Health & Wellness",
  "Events/Venues",
  "Other",
];

function getAdminKey(): string | null {
  return sessionStorage.getItem("leander-live-admin-key");
}

type Lead = {
  _id: Id<"businessLeads">;
  businessName: string;
  contactName: string;
  email?: string;
  phone?: string;
  vertical: string;
  interests: string[];
  source: string;
  status: string;
  assignedBusinessName: string | null;
  salePrice?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

type Business = {
  _id: Id<"businesses">;
  name: string;
  vertical: string;
  contactName: string;
  email?: string;
  phone?: string;
  status: string;
  createdAt: number;
};

export function AdminLeads() {
  const [adminKey, setAdminKey] = useState<string | null>(getAdminKey());
  const [keyInput, setKeyInput] = useState("");
  const [selectedId, setSelectedId] = useState<Id<"businessLeads"> | null>(null);
  const [err, setErr] = useState("");

  if (!adminKey) {
    return (
      <div className="mx-auto max-w-md px-4 py-24">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> Leander Live CRM
            </CardTitle>
            <CardDescription>Enter the admin key to view the lead pipeline.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!keyInput.trim()) return;
                sessionStorage.setItem("leander-live-admin-key", keyInput.trim());
                setAdminKey(keyInput.trim());
              }}
            >
              <Input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Admin key"
                aria-label="Admin key"
              />
              <Button type="submit">Unlock</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Lead Pipeline</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            sessionStorage.removeItem("leander-live-admin-key");
            setAdminKey(null);
          }}
        >
          Lock
        </Button>
      </div>
      {err && <p className="mb-4 text-sm font-medium text-destructive">{err}</p>}
      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="businesses">Businesses</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline">
          <PipelineBoard adminKey={adminKey} onSelect={setSelectedId} onError={setErr} />
        </TabsContent>
        <TabsContent value="businesses">
          <BusinessesTab adminKey={adminKey} onError={setErr} />
        </TabsContent>
      </Tabs>
      <Sheet open={selectedId !== null} onOpenChange={(o) => !o && setSelectedId(null)}>
        {selectedId && (
          <LeadDetail
            adminKey={adminKey}
            leadId={selectedId}
            onClose={() => setSelectedId(null)}
            onError={setErr}
          />
        )}
      </Sheet>
    </div>
  );
}

function PipelineBoard({
  adminKey,
  onSelect,
  onError,
}: {
  adminKey: string;
  onSelect: (id: Id<"businessLeads">) => void;
  onError: (msg: string) => void;
}) {
  const leads = useQuery(api.crm.listLeads, { adminKey }) as Lead[] | undefined;

  if (leads === undefined) return <p className="text-muted-foreground">Loading leads…</p>;
  if (leads === null) {
    onError("Not authorized — check the admin key.");
    return <p className="text-destructive">Could not load leads.</p>;
  }

  return (
    <div className="grid auto-cols-[240px] grid-flow-col gap-3 overflow-x-auto pb-4">
      {STAGES.map((stage) => {
        const inStage = leads.filter((l) => l.status === stage);
        return (
          <div key={stage} className="rounded-lg bg-muted/60 p-2.5">
            <h3 className="mb-2 flex items-center justify-between px-1 text-sm font-semibold capitalize">
              {stage}
              <Badge variant="secondary">{inStage.length}</Badge>
            </h3>
            <div className="flex flex-col gap-2">
              {inStage.map((l) => (
                <Card key={l._id.toString()} className="cursor-pointer hover:border-primary" onClick={() => onSelect(l._id)}>
                  <CardContent className="p-3">
                    <p className="text-sm font-semibold">{l.businessName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {l.contactName} · {l.vertical}
                      {l.assignedBusinessName ? ` → ${l.assignedBusinessName}` : ""}
                      {l.salePrice != null ? ` · $${l.salePrice}` : ""}
                    </p>
                    <Badge variant="outline" className="mt-2 text-[11px]">{l.source}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeadDetail({
  adminKey,
  leadId,
  onClose,
  onError,
}: {
  adminKey: string;
  leadId: Id<"businessLeads">;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const detail = useQuery(api.crm.getLead, { adminKey, leadId });
  const moveStage = useMutation(api.crm.moveLeadStage);
  const assignLead = useMutation(api.crm.assignLead);
  const markSold = useMutation(api.crm.markSold);
  const addNote = useMutation(api.crm.addLeadNote);
  const [note, setNote] = useState("");
  const [price, setPrice] = useState("");
  const [assignId, setAssignId] = useState("");

  async function run(fn: () => Promise<unknown>, ok?: () => void) {
    try {
      onError("");
      await fn();
      ok?.();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  if (detail === undefined) {
    return (
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Loading…</SheetTitle>
        </SheetHeader>
      </SheetContent>
    );
  }
  if (detail === null) return null;
  const lead = detail as Lead & {
    candidates: { _id: Id<"businesses">; name: string; vertical: string }[];
  };

  return (
    <SheetContent className="overflow-y-auto">
      <SheetHeader>
        <SheetTitle>{lead.businessName}</SheetTitle>
        <SheetDescription>
          {lead.contactName} · {lead.vertical} · via {lead.source}
        </SheetDescription>
      </SheetHeader>
      <div className="mt-4 flex flex-col gap-4 text-sm">
        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5">
          <dt className="text-muted-foreground">Email</dt>
          <dd>{lead.email ?? "—"}</dd>
          <dt className="text-muted-foreground">Phone</dt>
          <dd>{lead.phone ?? "—"}</dd>
          <dt className="text-muted-foreground">Wants</dt>
          <dd>{lead.interests.join(", ")}</dd>
          <dt className="text-muted-foreground">Assigned to</dt>
          <dd>{lead.assignedBusinessName ?? "Unassigned"}</dd>
          {lead.salePrice != null && (
            <>
              <dt className="text-muted-foreground">Sale price</dt>
              <dd>${lead.salePrice}</dd>
            </>
          )}
        </dl>

        <Separator />

        <div>
          <h4 className="mb-2 font-semibold">Move stage</h4>
          <div className="flex flex-wrap gap-2">
            {STAGES.filter((s) => s !== lead.status).map((s) => (
              <Button key={s} size="sm" variant="outline" onClick={() => run(() => moveStage({ adminKey, leadId, status: s }))}>
                → {s}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-2 font-semibold">Sell to the right business</h4>
          <div className="flex gap-2">
            <Select value={assignId} onValueChange={setAssignId}>
              <SelectTrigger aria-label="Assign to business">
                <SelectValue placeholder="Pick a business…" />
              </SelectTrigger>
              <SelectContent>
                {lead.candidates.map((b) => (
                  <SelectItem key={b._id.toString()} value={b._id.toString()}>
                    {b.name} ({b.vertical})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!assignId}
              onClick={() =>
                run(() =>
                  assignLead({ adminKey, leadId, businessId: assignId as Id<"businesses"> }).then(() =>
                    setAssignId(""),
                  ),
                )
              }
            >
              Assign
            </Button>
          </div>
        </div>

        <div>
          <h4 className="mb-2 font-semibold">Mark sold</h4>
          <div className="flex gap-2">
            <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$ price" inputMode="decimal" aria-label="Sale price" />
            <Button disabled={!price} onClick={() => run(() => markSold({ adminKey, leadId, price: Number(price) }).then(() => setPrice("")))}>
              Mark sold
            </Button>
          </div>
        </div>

        <div>
          <h4 className="mb-2 font-semibold">Notes</h4>
          <div className="flex flex-col gap-2">
            {lead.notes?.split("\n").map((n, i) => (
              <div key={i} className="rounded-md bg-muted px-3 py-2 text-sm">{n}</div>
            )) ?? <p className="text-muted-foreground">No notes yet.</p>}
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" aria-label="Add a note" rows={2} />
            <Button disabled={!note.trim()} onClick={() => run(() => addNote({ adminKey, leadId, note }).then(() => setNote("")))}>
              Add note
            </Button>
          </div>
        </div>

        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </SheetContent>
  );
}

function BusinessesTab({ adminKey, onError }: { adminKey: string; onError: (msg: string) => void }) {
  const businesses = useQuery(api.crm.listBusinesses, { adminKey }) as Business[] | undefined;
  const createBusiness = useMutation(api.crm.createBusiness);
  const setStatus = useMutation(api.crm.setBusinessStatus);
  const [form, setForm] = useState({ name: "", vertical: "Home Services", contactName: "", email: "", phone: "" });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      onError("");
      await createBusiness({ adminKey, ...form });
      setForm({ name: "", vertical: "Home Services", contactName: "", email: "", phone: "" });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not create business.");
    }
  }

  return (
    <div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Add a business</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={create}>
            <div className="grid gap-1.5">
              <Label>Business name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid gap-1.5">
              <Label>Vertical</Label>
              <Select value={form.vertical} onValueChange={(v) => setForm({ ...form, vertical: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VERTICALS.map((v) => (<SelectItem key={v} value={v}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Contact name</Label>
              <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} required />
            </div>
            <div className="grid gap-1.5">
              <Label>Email (optional)</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Phone (optional)</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="flex items-end">
              <Button type="submit">Add business</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {businesses === undefined ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Vertical</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {businesses.map((b) => (
                <TableRow key={b._id.toString()}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{b.vertical}</TableCell>
                  <TableCell>{b.contactName}{b.phone ? ` · ${b.phone}` : ""}</TableCell>
                  <TableCell><Badge variant="outline">{b.status}</Badge></TableCell>
                  <TableCell>
                    <Select
                      value={b.status}
                      onValueChange={(s) =>
                        setStatus({ adminKey, businessId: b._id, status: s }).catch((err) =>
                          onError(err instanceof Error ? err.message : "Update failed."),
                        )
                      }
                    >
                      <SelectTrigger className="w-32" aria-label={`Status for ${b.name}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["prospect", "active", "paused"].map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
