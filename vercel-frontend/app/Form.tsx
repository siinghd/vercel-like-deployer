'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { handleFormAction } from '@/actions';
import { useFormState } from 'react-dom';
import { useEffect, useState } from 'react';
import { Siemreap } from 'next/font/google';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import Logs from '@/components/Logs';

const generateSlug = (githubUrl: string, projectPath: string): string => {
  try {
    const parsedUrl = new URL(githubUrl);
    const pathname = parsedUrl.pathname;
    const slugBase = projectPath
      ? `${projectPath}-${pathname.split('/').slice(1, 3).join('-')}`
      : pathname.split('/').slice(1, 3).join('-');

    // Remove characters that are not letters or numbers
    const cleanSlug = slugBase.replace(/[^a-zA-Z0-9-]/g, '');

    return cleanSlug.toLowerCase();
  } catch (error) {
    return 'provide a valid url';
  }
};

export default function Form() {
  const [data, setdata] = useState<any>(null);
  const [projectPath, setProjectPath] = useState('');
  const [githubUrl, setGithubUrl] = useState('');

  const [siteWillBE, setSiteWillBE] = useState('');
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formdata = new FormData(e.currentTarget);
    const githubUrl = formdata.get('githubUrl') as string;
    const envFile = formdata.get('envFile') as string;
    const installCmd = formdata.get('installCmd') as string;
    const buildCmd = formdata.get('buildCmd') as string;
    const runCmd = formdata.get('runCmd') as string;
    const projectPath = formdata.get('projectPath') as string;
    const res = await handleFormAction({
      githubUrl,
      envFile,
      installCmd,
      buildCmd,
      runCmd,
      projectPath,
    });
    setdata(res);
  };

  useEffect(() => {
    if (githubUrl || projectPath) {
      setSiteWillBE(generateSlug(githubUrl, projectPath));
    }
  }, [githubUrl, projectPath]);

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full m-auto flex justify-center mt-12 mb-12"
    >
      <div className="flex flex-col w-full container max-w-3xl justify-center space-y-6">
        <div className="space-y-6 ">
          <Label htmlFor="github-url">GitHub URL</Label>
          <Input
            id="githubUrl"
            placeholder="Enter your GitHub URL"
            type="text"
            name="githubUrl"
            value={githubUrl}
            onChange={(e) => {
              setGithubUrl(e.target.value);
            }}
          />
        </div>
        {/* <div className="space-y-6 ">
          <Label htmlFor="packageManager">Package manager</Label>
          <select className='p-3'>
            <option value="pnpm">pnpm</option>
            <option value="yarn">yarn</option>
            <option value="npm">npm</option>
          </select>
        </div> */}
        <div className="space-y-6 ">
          <Label htmlFor="installCmd">Install command</Label>
          <Input
            id="installCmd"
            placeholder="pnpm install"
            type="text"
            name="installCmd"
          />
        </div>
        <div className="space-y-6 ">
          <Label htmlFor="buildCmd">Build command</Label>
          <Input
            id="buildCmd"
            placeholder="pnpm run build"
            type="text"
            name="buildCmd"
          />
        </div>
        <div className="space-y-6 ">
          <Label htmlFor="runCmd">Run command</Label>
          <Input
            id="runCmd"
            placeholder="pnpm run start"
            type="text"
            name="runCmd"
          />
        </div>
        <div className="space-y-6 ">
          <Label htmlFor="projectPath">Project Path</Label>
          <Input
            id="projectPath"
            placeholder="./"
            type="text"
            value={projectPath}
            name="projectPath"
            onChange={(e) => {
              setProjectPath(e.target.value);
            }}
          />
        </div>
        <div className="">
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
          <>
            <p>Your url will be: {`https://${siteWillBE}-x.hsingh.site`}</p>
            <p>
              Your logs will be:
              {`https://api-deployer.hsingh.site/logs/${siteWillBE}`}
            </p>
          </>
        )}

        <Button type="submit">Submit</Button>
        {data?.map(
          (res: any, ind: number) =>
            res && (
              <>
                <Alert
                  className="border-blue-700 bg-blue-50"
                  key={ind}
                  variant="default"
                >
                  <AlertTitle>{res?.message}</AlertTitle>
                  {res?.siteUrl && (
                    <AlertDescription>
                      Site URL:{' '}
                      <Link
                        className="text-blue-600"
                        href={`${res?.siteUrl}`}
                        target="_blank"
                      >
                        {res?.siteUrl}
                      </Link>
                    </AlertDescription>
                  )}
                  {res?.logUrl && (
                    <AlertDescription>
                      Log URL:{' '}
                      <Link
                        className="text-blue-600"
                        href={`${res?.logUrl}`}
                        target="_blank"
                      >
                        {res?.logUrl}
                      </Link>
                    </AlertDescription>
                  )}
                </Alert>
                {res?.logUrl && <Logs url={res.logUrl} />}
              </>
            )
        )}
        {!data && siteWillBE && !siteWillBE.includes('provide a valid url') && (
          <>
            <p>Your previous logs (if any):</p>
            <Logs url={`https://api-deployer.hsingh.site/logs/${siteWillBE}`} />
          </>
        )}
      </div>
    </form>
  );
}
