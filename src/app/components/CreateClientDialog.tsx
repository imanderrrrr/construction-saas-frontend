import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient, type ClientResponse } from '../services/clients';
import { ApiError } from '../lib/api';
import { cn } from './ui/utils';
import { PrimaryButton, SecondaryButton } from './onboarding/chrome';
import { BtModal } from './bt/windows';
import { FieldError, FieldHint, FieldLabel, INPUT, INPUT_ERROR } from './projects/bt';

interface CreateClientDialogProps {
    open: boolean;
    onClose: () => void;
    onCreated: (client: ClientResponse) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 04E — create a client without leaving the project window, 460 px. */
export function CreateClientDialog({ open, onClose, onCreated }: CreateClientDialogProps) {
    const { t } = useTranslation(['finance', 'common']);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [nameError, setNameError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const resetForm = () => {
        setName('');
        setEmail('');
        setPhone('');
        setNameError('');
        setEmailError('');
        setIsLoading(false);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        const trimmedEmail = email.trim();

        let hasError = false;
        if (!trimmedName) {
            setNameError(t('finance:createClient.nameRequired'));
            hasError = true;
        }
        if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
            setEmailError(t('finance:createClient.invalidEmail'));
            hasError = true;
        }
        if (hasError) return;

        setIsLoading(true);
        try {
            const client = await createClient({
                name: trimmedName,
                ...(trimmedEmail && { email: trimmedEmail }),
                ...(phone.trim() && { phone: phone.trim() }),
            });
            toast.success(t('finance:createClient.successTitle'), { description: t('finance:createClient.successDesc', { name: client.name }) });
            onCreated(client);
            handleClose();
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error(t('finance:createClient.errorStatus', { status: err.status }), { description: err.message });
            } else {
                toast.error(t('finance:createClient.errorGeneric'));
            }
            setIsLoading(false);
        }
    };

    return (
        <BtModal
            open={open}
            onOpenChange={o => { if (!o) handleClose(); }}
            width={460}
            kicker={t('finance:createClient.kicker')}
            title={t('finance:createClient.title')}
            description={t('finance:createClient.description')}
            dismissible={false}
            closeDisabled={isLoading}
            footer={(
                <>
                    <SecondaryButton onClick={handleClose} disabled={isLoading} className="px-4 py-[11px]">{t('common:buttons.cancel')}</SecondaryButton>
                    <PrimaryButton type="submit" form="create-client-form" disabled={isLoading} className="px-[18px] py-[11px]">
                        {isLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('finance:createClient.creating')}</> : t('common:buttons.create')}
                    </PrimaryButton>
                </>
            )}
        >
            <form id="create-client-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                    <FieldLabel htmlFor="create-client-name" required>{t('finance:createClient.nameLabel')}</FieldLabel>
                    <input
                        id="create-client-name"
                        value={name}
                        onChange={e => { setName(e.target.value); setNameError(''); }}
                        placeholder={t('finance:createClient.namePlaceholder')}
                        maxLength={200}
                        disabled={isLoading}
                        autoFocus
                        className={cn(INPUT, 'h-[38px]', nameError && INPUT_ERROR)}
                    />
                    {nameError ? <FieldError>{nameError}</FieldError> : <FieldHint>{t('finance:createClient.nameHint')}</FieldHint>}
                </div>
                <div>
                    <FieldLabel htmlFor="create-client-email">{t('finance:createClient.emailLabel')}</FieldLabel>
                    <input
                        id="create-client-email"
                        type="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                        placeholder="cliente@ejemplo.com"
                        maxLength={200}
                        disabled={isLoading}
                        className={cn(INPUT, 'h-[38px]', emailError && INPUT_ERROR)}
                    />
                    {emailError && <FieldError>{emailError}</FieldError>}
                </div>
                <div>
                    <FieldLabel htmlFor="create-client-phone">{t('finance:createClient.phoneLabel')}</FieldLabel>
                    <input
                        id="create-client-phone"
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+52 33 1234 5678"
                        maxLength={30}
                        disabled={isLoading}
                        className={cn(INPUT, 'h-[38px]')}
                    />
                    <FieldHint>{t('finance:createClient.phoneHint')}</FieldHint>
                </div>
                <p className="text-[12.5px] leading-[1.5] text-[#5A5346]">{t('finance:createClient.note')}</p>
            </form>
        </BtModal>
    );
}
