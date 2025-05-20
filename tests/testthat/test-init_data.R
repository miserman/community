test_that("adds data when specified", {
  dir <- paste0(tempdir(TRUE), "/test_data")
  dir.create(dir)
  on.exit(unlink(dir, TRUE, TRUE))
  path <- paste0(dir, "/mtcars.csv")
  write.csv(
    cbind(mtcars, group = sample(c("a", "b"), nrow(mtcars), TRUE)),
    path,
    row.names = FALSE
  )
  expect_equal(
    init_data("mtcars", filename = path, write = FALSE)$resources,
    data_add(path, write = FALSE)
  )
})
