test_that("check_template passes", {
  dir <- tempdir(TRUE)
  on.exit(unlink(dir, TRUE, TRUE))
  init_package("test_context", dir = dir)
  dir <- paste0(dir, "/test_context")
  init_template(
    "test",
    list(list(c("this.R", "andthis.R"), "orthis.R"), "test.R"),
    dir = dir,
    overwrite = TRUE
  )
  expect_true(check_template("template", "test", dir = dir)$exists)
})
