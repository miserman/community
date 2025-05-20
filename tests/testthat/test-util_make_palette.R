test_that("print works", {
  expect_identical(
    capture.output(util_make_palette("red", FALSE)),
    strsplit(
      jsonlite::toJSON(
        util_make_palette("red", FALSE, print = FALSE),
        auto_unbox = TRUE,
        pretty = TRUE
      ),
      "\n"
    )[[1]]
  )
})

test_that("discrete works", {
  expect_identical(
    util_make_palette(c(255, 0, 0), FALSE, print = FALSE),
    list(name = "custom", type = "discrete", colors = "#FF0000")
  )
})

test_that("continuous works", {
  expect_identical(
    util_make_palette(c("#c3c0f5"), TRUE, print = FALSE),
    list(
      name = "custom",
      type = "continuous",
      colors = list(
        matrix(
          c(195, -97.5, 192, -96, 245, -122.5),
          2,
          dimnames = list(NULL, c("red", "green", "blue"))
        ),
        c(red = 97.5, green = 96, blue = 122.5),
        matrix(
          c(0, 97.5, 0, 96, 0, 122.5),
          2,
          dimnames = list(NULL, c("red", "green", "blue"))
        )
      )
    )
  )
  expect_identical(
    util_make_palette(c("#c3c0f5", "#5a0ed5"), TRUE, print = FALSE),
    list(
      name = "custom",
      type = "continuous",
      colors = list(
        matrix(
          c(90, 52.5, 14, 89, 213, 16),
          2,
          dimnames = list(NULL, c("red", "green", "blue"))
        ),
        c(red = 142.5, green = 103, blue = 229),
        matrix(
          c(195, -52.5, 192, -89, 245, -16),
          2,
          dimnames = list(NULL, c("red", "green", "blue"))
        )
      )
    )
  )
})

test_that("continuous-divergent works", {
  expect_identical(
    util_make_palette(
      c("#762a83", "#fbd6ec", "#d9f0d3", "#1b7837"),
      TRUE,
      print = FALSE
    ),
    list(
      name = "custom",
      type = "continuous-divergent",
      colors = list(
        matrix(
          c(27, 207, 120, 107, 55, 168.5),
          2,
          dimnames = list(NULL, c("red", "green", "blue"))
        ),
        c(red = 234, green = 227, blue = 223.5),
        matrix(
          c(118, 116, 42, 185, 131, 92.5),
          2,
          dimnames = list(NULL, c("red", "green", "blue"))
        )
      )
    )
  )
})

test_that("polynomial works", {
  json <- capture.output(
    pal <- util_make_palette(
      rep(c("red", "green", "blue"), each = 10),
      polynomial = TRUE
    )
  )
  unlink("Rplots.pdf")
  expect_identical(json[1], "{")
  expect_identical(
    round(pal$colors[, 1], 4),
    c(
      254.12,
      -259.1603,
      9324.1158,
      -64523.4285,
      147834.6691,
      -140833.7305,
      48205.6705
    )
  )
})
