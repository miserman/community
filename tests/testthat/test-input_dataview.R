test_that("reformats properly", {
  expect_equal(
    list(
      palette = "",
      time_agg = "last",
      time_filters = list(),
      dataset = "dataset",
      ids = "ids",
      features = list("features")
    ),
    input_dataview(dataset = "dataset", ids = "ids", features = "features")
  )
})


test_that("build environment is added to", {
  content <- input_dataview(
    dataset = "dataset",
    ids = "ids",
    features = "features"
  )
  parts <- make_build_environment()
  eval(
    expression(
      input_dataview(dataset = "dataset", ids = "ids", features = "features")
    ),
    parts
  )
  expect_identical(parts$dataviews$view0, content)
})
