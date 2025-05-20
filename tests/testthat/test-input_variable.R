test_that("parse cases properly", {
  expect_equal(
    list(
      id = "variable",
      states = list(
        list(
          condition = list(
            list(id = "a", type = "!", value = "", any = TRUE),
            list(id = "b", type = "", value = "", any = TRUE)
          ),
          value = 0
        ),
        list(
          condition = list(
            list(id = "c", type = "=", value = 1)
          ),
          value = 1
        )
      ),
      default = ""
    ),
    input_variable(
      "variable",
      list(
        "!a || b" = 0,
        "c == 1" = 1
      )
    )
  )
})

test_that("build environment is added to", {
  content <- input_variable(
    "variable",
    list(
      "!a && b" = 0,
      "c != 1" = 1
    )
  )
  parts <- make_build_environment()
  eval(
    expression(
      input_variable(
        "variable",
        list(
          "!a && b" = 0,
          "c != 1" = 1
        )
      )
    ),
    parts
  )
  expect_identical(parts$variables[[1]], content)
})
