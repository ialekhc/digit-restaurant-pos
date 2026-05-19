export const validateRequest = (schemaParser) => {
  return (req, _res, next) => {
    const parsed = schemaParser(req);
    req.validated = parsed;
    next();
  };
};
