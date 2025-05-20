skip_if_not(grepl("R_LIBS", getwd(), fixed = TRUE), "not downloading data")

dir <- paste0(tempdir(), "/datacommons")
dir_view <- paste0(tempdir(), "/view")

test_that("initialization works", {
  init_datacommons(
    dir,
    repos = "uva-bi-sdad/sdc.education",
    refresh_after = TRUE
  )
  expect_true(dir.exists(paste0(dir, "/repos/sdc.education")))
})

test_that("mapping works", {
  datacommons_map_files(dir, overwrite = TRUE)
  expect_identical(
    list.files(paste0(dir, "/cache")),
    c("id_map.rds", "measure_info.json", "variable_map.csv")
  )
})

test_that("find variables", {
  expect_identical(
    datacommons_find_variables("daycare", dir)[[1]]$variable,
    paste0("daycare_", c("capacity", "ratio", "min_drivetime"))
  )
})

test_that("view works", {
  variables <- unique(
    read.csv(paste0(dir, "/cache/variable_map.csv"))$full_name
  )
  datacommons_view(
    dir,
    "view",
    dir_view,
    variables = variables,
    ids = paste0("5100", c(1, 3, 5, 7)),
    verbose = FALSE
  )
  expect_true(dir.exists(dir_view))
  expect_true(
    length(
      jsonlite::read_json(
        paste0(dir_view, "/manifest.json")
      )[["uva-bi-sdad/sdc.education"]]$files
    ) !=
      0
  )
  datacommons_view(
    dir,
    "view",
    dir_view,
    variables = variables[1:5],
    ids = paste0("5100", c(1, 3, 5)),
    verbose = FALSE
  )
  expect_identical(
    unlist(
      jsonlite::read_json(paste0(dir, "/views/view/view.json"))$variables
    ),
    variables[1:5]
  )
  datacommons_view(
    dir,
    "view2",
    dir_view,
    variables = variables,
    ids = paste0("5100", c(1, 3, 5, 7)),
    verbose = FALSE
  )
  expect_true(file.exists(paste0(dir, "/views/view2/view.json")))
})
