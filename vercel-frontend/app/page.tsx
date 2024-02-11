import Image from 'next/image';

export default function Home() {
  const handleFormAction = async (formdata: FormData) => {
    'use server';
    const githubUrl =  formdata.get('githubUrl') as string;
    const envFile =  formdata.get('envFile') as string;
    console.log(githubUrl, envFile);
    const response = await fetch('http://localhost:3000/deploy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ githubUrl, envFile }),
    });
    const data = await response.text();
    console.log(data);
  };
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-10">
      <form action={handleFormAction} className="flex flex-col gap-4 w-[50%]">
        <input type="text" placeholder="GitHub URL" name="githubUrl" />
        <textarea placeholder="Environment Variables" name="envFile" />
        <button type="submit">Deploy</button>
      </form>
    </main>
  );
}
