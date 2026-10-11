const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const Product = require("./models/Product");
const errorHandler = require("./middleware/errorHandler");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 8080;
const mongourl = process.env.mongourl;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Inventory Management API is running"
  });
});

app.post("/api/products", async (req, res, next) => {
  try {
    const product = new Product(req.body);

    const savedProduct = await product.save();

    res.status(201).json(savedProduct);
  } catch (error) {
    next(error);
  }
});

app.get("/api/products", async (req, res, next) => {
  try {
    const {
      category,
      search,
      minPrice,
      maxPrice,
      sort,
      page = 1,
      limit = 10
    } = req.query;

    let filter = {};

    if (category) {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } }
      ];
    }

    if (minPrice) {
      filter.price = {
        ...filter.price,
        $gte: Number(minPrice)
      };
    }

    if (maxPrice) {
      filter.price = {
        ...filter.price,
        $lte: Number(maxPrice)
      };
    }

    let sortOption = {};

    if (sort) {
      if (sort.startsWith("-")) {
        const field = sort.substring(1);
        sortOption[field] = -1;
      } else {
        sortOption[sort] = 1;
      }
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    const skip = (pageNumber - 1) * limitNumber;

    const products = await Product.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNumber);

    const total = await Product.countDocuments(filter);

    res.json({
      total: total,
      page: pageNumber,
      limit: limitNumber,
      products: products
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/products/low-stock", async (req, res, next) => {
  try {
    const products = await Product.find({
      $expr: {
        $lte: ["$quantity", "$reorderLevel"]
      }
    });

    res.json({
      count: products.length,
      lowStockItems: products
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/products/summary", async (req, res, next) => {
  try {
    const summary = await Product.aggregate([
      {
        $group: {
          _id: "$category",

          totalItems: {
            $sum: 1
          },

          totalQuantity: {
            $sum: "$quantity"
          },

          totalStockValue: {
            $sum: "$stockValue"
          },

          avgPrice: {
            $avg: "$price"
          }
        }
      },
      {
        $sort: {
          _id: 1
        }
      }
    ]);

    res.json({
      categories: summary.length,
      summary: summary
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

app.put("/api/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    if (req.body.name !== undefined) {
      product.name = req.body.name;
    }

    if (req.body.sku !== undefined) {
      product.sku = req.body.sku;
    }

    if (req.body.category !== undefined) {
      product.category = req.body.category;
    }

    if (req.body.price !== undefined) {
      product.price = req.body.price;
    }

    if (req.body.quantity !== undefined) {
      product.quantity = req.body.quantity;
    }

    if (req.body.reorderLevel !== undefined) {
      product.reorderLevel = req.body.reorderLevel;
    }

    if (req.body.supplier !== undefined) {
      product.supplier = req.body.supplier;
    }

    const updatedProduct = await product.save();

    res.json(updatedProduct);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    await Product.findByIdAndDelete(req.params.id);

    res.json({
      message: "Product deleted",
      id: req.params.id
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/products/:id/stock", async (req, res, next) => {
  try {
    const { change } = req.body;

    if (change === undefined) {
      return res.status(400).json({
        message: "change is required"
      });
    }

    if (typeof change !== "number") {
      return res.status(400).json({
        message: "change must be a number"
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    const newQuantity = product.quantity + change;

    if (newQuantity < 0) {
      return res.status(400).json({
        message: "Stock cannot become negative"
      });
    }

    product.quantity = newQuantity;

    const updatedProduct = await product.save();

    res.json({
      message: "Stock updated",
      product: updatedProduct
    });
  } catch (error) {
    next(error);
  }
});

app.use(errorHandler);

mongoose
  .connect(mongourl)
  .then(() => {
    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.log("MongoDB connection failed");
    console.log(error);
  });