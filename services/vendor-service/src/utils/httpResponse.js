export const sendOk = (res, data, message = 'ok') => {
  return res.status(200).json({
    success: true,
    message,
    data
  });
};

export const sendCreated = (res, data, message = 'created') => {
  return res.status(201).json({
    success: true,
    message,
    data
  });
};
