import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    UserRound, Phone, Mail, FolderCheck, Plus, Search,
    Pencil, Loader2, AlertCircle, X,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle,
} from './ui/dialog';
import { toast } from 'sonner';
import {
    listClients,
    createClient,
    updateClient,
    type ClientResponse,
} from '../services/clients';
import { ApiError } from '../lib/api';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

// ─── helpers ───────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d\s\-().]{6,30}$/;

function apiErrorMsg(err: unknown): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return 'Unknown error';
}

// ─── Create Modal ──────────────────────────────────────────────────────────

interface CreateClientModalProps {
    open: boolean;
    onClose: () => void;
    onCreated: (c: ClientResponse) => void;
}

function CreateClientModal({ open, onClose, onCreated }: CreateClientModalProps) {
    const { t } = useTranslation('admin');

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string }>({});
    const [loading, setLoading] = useState(false);

    const reset = () => {
        setName(''); setPhone(''); setEmail('');
        setErrors({}); setLoading(false);
    };
    const handleClose = () => { reset(); onClose(); };

    const validate = (): boolean => {
        const next: typeof errors = {};
        if (!name.trim()) next.name = t('clients.form.nameRequired');
        if (!phone.trim()) {
            next.phone = t('clients.form.phoneRequired');
        } else if (!PHONE_RE.test(phone.trim())) {
            next.phone = t('clients.form.phoneInvalid');
        }
        if (email.trim() && !EMAIL_RE.test(email.trim())) {
            next.email = t('clients.form.emailInvalid');
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setLoading(true);
        try {
            const created = await createClient({
                name: name.trim(),
                phone: phone.trim(),
                ...(email.trim() ? { email: email.trim() } : {}),
            });
            toast.success(t('clients.toast.created'), { description: `"${created.name}"` });
            onCreated(created);
            handleClose();
        } catch (err) {
            const msg = apiErrorMsg(err);
            if (err instanceof ApiError && err.details) {
                const fieldErrors: typeof errors = {};
                if (err.details['name']) fieldErrors.name = err.details['name'];
                if (err.details['phone']) fieldErrors.phone = err.details['phone'];
                if (err.details['email']) fieldErrors.email = err.details['email'];
                if (Object.keys(fieldErrors).length > 0) {
                    setErrors(fieldErrors);
                } else {
                    toast.error(t('clients.toast.createFailed'), { description: msg });
                }
            } else {
                toast.error(t('clients.toast.createFailed'), { description: msg });
            }
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={o => { if (!o) handleClose(); }}>
            <DialogContent
                className="sm:max-w-md bg-white"
                onPointerDownOutside={e => e.preventDefault()}
                onInteractOutside={e => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle className="text-[#0A0A0A] flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-[#F97316]/10 flex items-center justify-center">
                            <UserRound className="w-3.5 h-3.5 text-[#F97316]" />
                        </div>
                        {t('clients.createModal.title')}
                    </DialogTitle>
                    <DialogDescription>{t('clients.createModal.description')}</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                    {/* Name */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-[#0A0A0A]">
                            {t('clients.form.nameLabel')} <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={name}
                            onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }}
                            placeholder={t('clients.form.namePlaceholder')}
                            maxLength={200}
                            className={`h-10 ${errors.name ? 'border-red-400 focus-visible:ring-red-400' : 'border-[#D4D4D8]'}`}
                            disabled={loading}
                            autoFocus
                        />
                        {errors.name && (
                            <p className="flex items-center gap-1 text-xs text-red-600">
                                <AlertCircle className="w-3 h-3 flex-shrink-0" />{errors.name}
                            </p>
                        )}
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-[#0A0A0A]">
                            {t('clients.form.phoneLabel')} <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            type="tel"
                            value={phone}
                            onChange={e => { setPhone(e.target.value); setErrors(p => ({ ...p, phone: undefined })); }}
                            placeholder={t('clients.form.phonePlaceholder')}
                            maxLength={30}
                            className={`h-10 ${errors.phone ? 'border-red-400 focus-visible:ring-red-400' : 'border-[#D4D4D8]'}`}
                            disabled={loading}
                        />
                        {errors.phone && (
                            <p className="flex items-center gap-1 text-xs text-red-600">
                                <AlertCircle className="w-3 h-3 flex-shrink-0" />{errors.phone}
                            </p>
                        )}
                    </div>

                    {/* Email (optional) */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-[#0A0A0A]">
                            {t('clients.form.emailLabel')}{' '}
                            <span className="text-[#71717A] font-normal text-xs">{t('clients.form.optional')}</span>
                        </Label>
                        <Input
                            type="email"
                            value={email}
                            onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }}
                            placeholder={t('clients.form.emailPlaceholder')}
                            maxLength={200}
                            className={`h-10 ${errors.email ? 'border-red-400 focus-visible:ring-red-400' : 'border-[#D4D4D8]'}`}
                            disabled={loading}
                        />
                        {errors.email && (
                            <p className="flex items-center gap-1 text-xs text-red-600">
                                <AlertCircle className="w-3 h-3 flex-shrink-0" />{errors.email}
                            </p>
                        )}
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={handleClose} disabled={loading}
                            className="border-[#D4D4D8] text-[#0A0A0A]">
                            {t('clients.form.cancel')}
                        </Button>
                        <Button type="submit"
                            className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2"
                            disabled={loading}>
                            {loading
                                ? <><Loader2 className="w-4 h-4 animate-spin" />{t('clients.form.creating')}</>
                                : t('clients.form.create')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ─── Edit Modal ────────────────────────────────────────────────────────────

interface EditClientModalProps {
    client: ClientResponse | null;
    open: boolean;
    onClose: () => void;
    onUpdated: (c: ClientResponse) => void;
}

function EditClientModal({ client, open, onClose, onUpdated }: EditClientModalProps) {
    const { t } = useTranslation('admin');

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string }>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (client) {
            setName(client.name);
            setPhone(client.phone ?? '');
            setEmail(client.email ?? '');
            setErrors({});
            setLoading(false);
        }
    }, [client]);

    const handleClose = () => { setErrors({}); setLoading(false); onClose(); };

    const validate = (): boolean => {
        const next: typeof errors = {};
        if (!name.trim()) next.name = t('clients.form.nameRequired');
        if (!phone.trim()) {
            next.phone = t('clients.form.phoneRequired');
        } else if (!PHONE_RE.test(phone.trim())) {
            next.phone = t('clients.form.phoneInvalid');
        }
        if (email.trim() && !EMAIL_RE.test(email.trim())) {
            next.email = t('clients.form.emailInvalid');
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!client || !validate()) return;
        setLoading(true);
        try {
            const updated = await updateClient(client.id, {
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim() || undefined,
            });
            toast.success(t('clients.toast.updated'), { description: `"${updated.name}"` });
            onUpdated(updated);
            handleClose();
        } catch (err) {
            const msg = apiErrorMsg(err);
            if (err instanceof ApiError && err.details) {
                const fieldErrors: typeof errors = {};
                if (err.details['name']) fieldErrors.name = err.details['name'];
                if (err.details['phone']) fieldErrors.phone = err.details['phone'];
                if (err.details['email']) fieldErrors.email = err.details['email'];
                if (Object.keys(fieldErrors).length > 0) {
                    setErrors(fieldErrors);
                } else {
                    toast.error(t('clients.toast.updateFailed'), { description: msg });
                }
            } else {
                toast.error(t('clients.toast.updateFailed'), { description: msg });
            }
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={o => { if (!o) handleClose(); }}>
            <DialogContent
                className="sm:max-w-md bg-white"
                onPointerDownOutside={e => e.preventDefault()}
                onInteractOutside={e => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle className="text-[#0A0A0A] flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-[#F97316]/10 flex items-center justify-center">
                            <Pencil className="w-3.5 h-3.5 text-[#F97316]" />
                        </div>
                        {t('clients.editModal.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {client ? t('clients.editModal.description', { name: client.name }) : ''}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                    {/* Name */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-[#0A0A0A]">
                            {t('clients.form.nameLabel')} <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={name}
                            onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }}
                            placeholder={t('clients.form.namePlaceholder')}
                            maxLength={200}
                            className={`h-10 ${errors.name ? 'border-red-400 focus-visible:ring-red-400' : 'border-[#D4D4D8]'}`}
                            disabled={loading}
                        />
                        {errors.name && (
                            <p className="flex items-center gap-1 text-xs text-red-600">
                                <AlertCircle className="w-3 h-3 flex-shrink-0" />{errors.name}
                            </p>
                        )}
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-[#0A0A0A]">
                            {t('clients.form.phoneLabel')} <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            type="tel"
                            value={phone}
                            onChange={e => { setPhone(e.target.value); setErrors(p => ({ ...p, phone: undefined })); }}
                            placeholder={t('clients.form.phonePlaceholder')}
                            maxLength={30}
                            className={`h-10 ${errors.phone ? 'border-red-400 focus-visible:ring-red-400' : 'border-[#D4D4D8]'}`}
                            disabled={loading}
                        />
                        {errors.phone && (
                            <p className="flex items-center gap-1 text-xs text-red-600">
                                <AlertCircle className="w-3 h-3 flex-shrink-0" />{errors.phone}
                            </p>
                        )}
                    </div>

                    {/* Email (optional) */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-[#0A0A0A]">
                            {t('clients.form.emailLabel')}{' '}
                            <span className="text-[#71717A] font-normal text-xs">{t('clients.form.optional')}</span>
                        </Label>
                        <Input
                            type="email"
                            value={email}
                            onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }}
                            placeholder={t('clients.form.emailPlaceholder')}
                            maxLength={200}
                            className={`h-10 ${errors.email ? 'border-red-400 focus-visible:ring-red-400' : 'border-[#D4D4D8]'}`}
                            disabled={loading}
                        />
                        {errors.email && (
                            <p className="flex items-center gap-1 text-xs text-red-600">
                                <AlertCircle className="w-3 h-3 flex-shrink-0" />{errors.email}
                            </p>
                        )}
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={handleClose} disabled={loading}
                            className="border-[#D4D4D8] text-[#0A0A0A]">
                            {t('clients.form.cancel')}
                        </Button>
                        <Button type="submit"
                            className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2"
                            disabled={loading}>
                            {loading
                                ? <><Loader2 className="w-4 h-4 animate-spin" />{t('clients.form.saving')}</>
                                : t('clients.form.save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ─── Client Card ───────────────────────────────────────────────────────────

interface ClientCardProps {
    client: ClientResponse;
    onEdit: (c: ClientResponse) => void;
}

function ClientCard({ client, onEdit }: ClientCardProps) {
    const { t } = useTranslation('admin');

    return (
        <div className="bg-white border border-[#D4D4D8] rounded-xl p-5 flex flex-col gap-4 hover:shadow-md hover:border-[#F97316]/30 transition-all">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-[#F97316]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <UserRound className="w-5 h-5 text-[#F97316]" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0A0A0A] truncate leading-tight">
                            {client.name}
                        </p>
                        <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md mt-0.5 ${
                            client.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-[#FAFAFA] text-[#71717A]'
                        }`}>
                            {client.status === 'ACTIVE' ? t('clients.card.active') : t('clients.card.inactive')}
                        </span>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(client)}
                    className="h-8 w-8 p-0 text-[#71717A] hover:text-[#F97316] hover:bg-[#F97316]/10 flex-shrink-0"
                    title={t('clients.card.edit')}
                >
                    <Pencil className="w-3.5 h-3.5" />
                </Button>
            </div>

            {/* Contact Details */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-[#0A0A0A]">
                    <Phone className="w-3.5 h-3.5 text-[#71717A] flex-shrink-0" />
                    <span className="truncate">{client.phone ?? <span className="text-[#71717A]">—</span>}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#0A0A0A]">
                    <Mail className="w-3.5 h-3.5 text-[#71717A] flex-shrink-0" />
                    {client.email
                        ? <span className="truncate">{client.email}</span>
                        : <span className="text-[#71717A] text-xs italic">{t('clients.card.noEmail')}</span>
                    }
                </div>
            </div>

            {/* Footer: completed projects */}
            <div className="pt-3 border-t border-[#D4D4D8] flex items-center gap-2">
                <FolderCheck className="w-4 h-4 text-[#F97316] flex-shrink-0" />
                <span className="text-xs text-[#71717A]">
                    {t('clients.card.completedProjects', { count: client.completedProjectsCount })}
                </span>
            </div>
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ClientManagement() {
    const { t } = useTranslation('admin');

    const [clients, setClients] = useState<ClientResponse[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 24;

    const [createOpen, setCreateOpen] = useState(false);
    const [editClient, setEditClient] = useState<ClientResponse | null>(null);

    const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(0);
        }, 350);
        return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    }, [search]);

    const fetchClients = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await listClients(debouncedSearch || undefined, undefined, page, PAGE_SIZE);
            setClients(result.content);
            setTotal(result.totalElements);
        } catch (err) {
            setError(apiErrorMsg(err));
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, page]);

    useEffect(() => { fetchClients(); }, [fetchClients]);

    const handleCreated = (c: ClientResponse) => {
        setClients(prev => [c, ...prev]);
        setTotal(prev => prev + 1);
    };

    const handleUpdated = (c: ClientResponse) => {
        setClients(prev => prev.map(x => (x.id === c.id ? c : x)));
    };

    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-[#0A0A0A]">{t('clients.title')}</h1>
                    <p className="text-sm text-[#71717A] mt-0.5">{t('clients.subtitle')}</p>
                </div>
                <Button
                    onClick={() => setCreateOpen(true)}
                    className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2 self-start sm:self-auto"
                >
                    <Plus className="w-4 h-4" />
                    {t('clients.addClient')}
                </Button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
                <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={t('clients.searchPlaceholder')}
                    maxLength={FIELD_LIMITS.SEARCH}
                    className="pl-9 h-10 border-[#D4D4D8] bg-white max-w-sm"
                />
                {search && (
                    <button
                        onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#0A0A0A]"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Count */}
            {!loading && !error && (
                <p className="text-xs text-[#71717A]">
                    {t('clients.count', { count: total })}
                </p>
            )}

            {/* Content */}
            {loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-44 rounded-xl border border-[#D4D4D8] bg-white animate-pulse" />
                    ))}
                </div>
            )}

            {!loading && error && (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-red-200 bg-red-50">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                    <Button variant="ghost" size="sm" onClick={fetchClients} className="ml-auto text-red-600 hover:text-red-800">
                        {t('clients.retry')}
                    </Button>
                </div>
            )}

            {!loading && !error && clients.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-14 h-14 bg-[#F97316]/10 rounded-2xl flex items-center justify-center mb-4">
                        <UserRound className="w-7 h-7 text-[#F97316]" />
                    </div>
                    <p className="text-sm font-semibold text-[#0A0A0A]">
                        {debouncedSearch ? t('clients.noMatch') : t('clients.noClients')}
                    </p>
                    <p className="text-xs text-[#71717A] mt-1">
                        {debouncedSearch ? t('clients.noMatchHint') : t('clients.noClientsHint')}
                    </p>
                    {!debouncedSearch && (
                        <Button
                            onClick={() => setCreateOpen(true)}
                            className="mt-4 bg-[#F97316] hover:bg-[#C2410C] text-white gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            {t('clients.addClient')}
                        </Button>
                    )}
                </div>
            )}

            {!loading && !error && clients.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clients.map(c => (
                        <ClientCard key={c.id} client={c} onEdit={setEditClient} />
                    ))}
                </div>
            )}

            {/* Pagination */}
            {!loading && !error && totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="border-[#D4D4D8] text-[#0A0A0A]"
                    >
                        {t('clients.prev')}
                    </Button>
                    <span className="text-xs text-[#71717A]">
                        {t('clients.pageOf', { current: page + 1, total: totalPages })}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="border-[#D4D4D8] text-[#0A0A0A]"
                    >
                        {t('clients.next')}
                    </Button>
                </div>
            )}

            {/* Modals */}
            <CreateClientModal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onCreated={handleCreated}
            />
            <EditClientModal
                client={editClient}
                open={editClient !== null}
                onClose={() => setEditClient(null)}
                onUpdated={handleUpdated}
            />
        </div>
    );
}
