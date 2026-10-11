const errorHandler = (err, req, res, next) => {
  console.log(err);
  if (err.name === "ValidationError") {
    const errors = {};

    for (let field in err.errors) {
      errors[field] = err.errors[field].message;
    }

    return res.status(400).json({
      message: "Validation Error",
      errors: errors
    });
  }

  if (err.code === 11000) {
    return res.status(400).json({
      message: "SKU already exists"
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      message: "Invalid product ID"
    });
  }

  res.status(500).json({
    message: "Server Error"
  });
};

module.exports = errorHandler;