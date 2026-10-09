import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { PhotoGrid, usePhotoPicker } from '../../src/app/components/bt/PhotoPicker';
function Harness() {
 const picker = usePhotoPicker(2, 32, {invalidType:'INVALID_TYPE', tooLarge:'TOO_LARGE',tooMany:'TOO_MANY'});
 return <><PhotoGrid picker={picker} label={`Photos: ${picker.photos.length}`} removeLabel="Remove" addLabel="Add"/><output>{picker.photos.map(p=>p.name).join(',')}</output><Toaster /></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Harness /></React.StrictMode>);
