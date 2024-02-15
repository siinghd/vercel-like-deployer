'use server';

export const handleFormAction = async (formdata: {
  githubUrl: string;
  envFile: string;
  installCmd: string;
  buildCmd: string;
  runCmd: string;
  projectPath: string;
}) => {
  const response = await fetch('http://localhost:3001/deploy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      githubUrl: formdata.githubUrl,
      envFile: formdata.envFile,
      installCmd: formdata.installCmd,
      buildCmd: formdata.buildCmd,
      runCmd: formdata.runCmd,
      projectPath: formdata.projectPath,
    }),
  });
  try {
    const data = await response.json();
    return [data, null];
  } catch (error) {
    return [null, error];
  }
};
