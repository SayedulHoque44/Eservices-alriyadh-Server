export const handleDupliacteError = (err: any) => {
  const match = err.message.match(/"([^"]*)"/);
  //
  const extractMessage = match && match[1];

  return `${extractMessage} is already Taken!`;
};
