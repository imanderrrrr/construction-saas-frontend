import React, { useState } from 'react';
import { Building2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle,
} from './ui/dialog';
import { toast } from 'sonner';
import { createClient, type ClientResponse } from '../services/clients';
import { ApiError } from '../lib/api';

interface CreateClientDialogProps {
    open: boolean;
    onClose: () => void;
    onCreated: (client: ClientResponse) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CreateClientDialog({ open, onClose, onCreated }: CreateClientDialogProps) {
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

        // Validate
        let hasError = false;
        if (!trimmedName) {
            setNameError('Client name is required.');
            hasError = true;
        }
        if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
            setEmailError('Invalid email format.');
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
            toast.success('Client created', { description: `"${client.name}" is now available.` });
            onCreated(client);
            handleClose();
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error(`Error ${err.status}`, { description: err.message });
            } else {
                toast.error('Error creating client');
            }
            setIsLoading(false);
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
                            <Building2 className="w-3.5 h-3.5 text-[#F97316]" />
                        </div>
                        Create client
                    </DialogTitle>
                    <DialogDescription>
                        Add a new client to associate with projects.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-[#0A0A0A]">
                            Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={name}
                            onChange={e => { setName(e.target.value); setNameError(''); }}
                            placeholder="e.g. Acme Construction Corp"
                            maxLength={200}
                            className={`h-10 ${nameError ? 'border-red-400' : 'border-[#D4D4D8]'}`}
                            disabled={isLoading}
                            autoFocus
                        />
                        {nameError && (
                            <p className="flex items-center gap-1 text-xs text-red-600">
                                <AlertCircle className="w-3 h-3" />{nameError}
                            </p>
                        )}
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-[#0A0A0A]">Email</Label>
                        <Input
                            type="email"
                            value={email}
                            onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                            placeholder="client@example.com"
                            maxLength={200}
                            className={`h-10 ${emailError ? 'border-red-400' : 'border-[#D4D4D8]'}`}
                            disabled={isLoading}
                        />
                        {emailError && (
                            <p className="flex items-center gap-1 text-xs text-red-600">
                                <AlertCircle className="w-3 h-3" />{emailError}
                            </p>
                        )}
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-[#0A0A0A]">Phone</Label>
                        <Input
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder="+52 33 1234 5678"
                            maxLength={30}
                            className="h-10 border-[#D4D4D8]"
                            disabled={isLoading}
                        />
                    </div>

                    <DialogFooter className="pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={isLoading}
                            className="border-[#D4D4D8] text-[#0A0A0A]"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <><Loader2 className="w-4 h-4 animate-spin" />Creating…</>
                            ) : (
                                'Create'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
