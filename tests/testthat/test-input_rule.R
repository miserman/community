test_that("parse condition properly", {
  expect_equal(
    list(
      condition = list(
        list(id = "a", type = "=", value = 1),
        list(id = "b", type = "=", value = 2)
      ),
      effects = list(c = 3)
    ),
    input_rule("a == 1 && b == 2", list(c = 3))
  )
})

test_that("build environment is added to", {
  content <- input_rule("a == 1 || b == 2", list(c = 3))
  parts <- make_build_environment()
  eval(
    expression(
      input_rule("a == 1 || b == 2", list(c = 3))
    ),
    parts
  )
  expect_identical(parts$rules[[1]], content)
})
