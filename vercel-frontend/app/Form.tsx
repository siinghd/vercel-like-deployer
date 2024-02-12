'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { handleFormAction } from '@/actions';
import { useFormState } from 'react-dom';
import { useState } from 'react';
import { Siemreap } from 'next/font/google';
const generateSlug = (githubUrl: string): string => {
  try {
    const parsedUrl = new URL(githubUrl);
    const pathname = parsedUrl.pathname;
    return pathname.split('/').slice(1, 3).join('-').toLowerCase();
  } catch (error) {
    return 'provide a valid url';
  }
};
export default function Form() {
  const [data, setdata] = useState<any>(null);
  const [siteWillBE, setSiteWillBE] = useState('');
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formdata = new FormData(e.currentTarget);

    console.log(formdata.get('githubUrl'));
    const githubUrl = formdata.get('githubUrl') as string;
    const envFile = formdata.get('envFile') as string;
    const res = await handleFormAction({
      githubUrl,
      envFile,
    });
    setdata(res);
  };
  return (
    <form onSubmit={handleSubmit} className="w-full m-auto flex justify-center">
      <div className="grid w-full max-w-md gap-6">
        <div className="grid gap-1.5">
          <Label htmlFor="github-url">GitHub URL</Label>
          <Input
            id="githubUrl"
            placeholder="Enter your GitHub URL"
            type="text"
            name="githubUrl"
            onChange={(e) => {
              if (e.target.value) {
                setSiteWillBE(generateSlug(e.target.value));
              }
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="environment-file">Environment File</Label>
          <Textarea
            rows={15}
            id="envFile"
            placeholder="Paste your environment file here"
            name="envFile"
          />
        </div>
        {siteWillBE && siteWillBE.includes('provide a valid url') && (
          <p>Provide a valid url</p>
        )}
        {siteWillBE && !siteWillBE.includes('provide a valid url') && (
          <p>Your url will be: {`https://${siteWillBE}-x.hsingh.site`}</p>
        )}

        <Button type="submit">Submit</Button>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </form>
  );
}
