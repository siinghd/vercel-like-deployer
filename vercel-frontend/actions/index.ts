'use server';

export const handleFormAction = async (formdata: {
  githubUrl: string;
  envFile: string;
}) => {
  const response = await fetch('https://api-deployer.hsingh.site/deploy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      githubUrl: formdata.githubUrl,
      envFile: formdata.envFile,
    }),
  });
  try {
    const data = await response.json();
    return [data, null];
  } catch (error) {
    return [null, error];
  }
};
